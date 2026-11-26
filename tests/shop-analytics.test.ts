import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import { buildApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import type { ShopOrderStatus } from "../generated/prisma/client";
import { resetDb } from "./helpers";

const app = buildApp();

let customerId: number;

beforeAll(async () => {
    await app.ready();
});

afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
});

beforeEach(async () => {
    await resetDb();

    const customer = await prisma.customer.create({
        data: {
            fullName: "Іван Петренко",
            phone: "+380501234567",
        },
    });

    customerId = customer.id;
});

async function getPart(sku: string) {
    return prisma.part.findUniqueOrThrow({
        where: { sku },
    });
}

async function addOrder(
    sku: string,
    quantity: number,
    unitPrice: number,
    createdAt: string,
    status: ShopOrderStatus = "shipped",
) {
    const part = await getPart(sku);

    return prisma.shopOrder.create({
        data: {
            customerId,
            status,
            createdAt: new Date(createdAt),
            items: {
                create: {
                    partId: part.id,
                    quantity,
                    unitPrice,
                },
            },
        },
    });
}

describe("GET /analytics/top-parts", () => {
    it("returns an empty list when there are no orders", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/analytics/top-parts",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    it("calculates the top three parts in each category", async () => {
        const date = "2026-01-15T12:00:00Z";

        // Дисплеї: 300, 200, 100, 50.
        // Четверта позиція не повинна потрапити до топ-3.

        await addOrder("APL-IP12-SCR", 3, 100, date);
        await addOrder("APL-IP13-SCR", 2, 100, date);
        await addOrder("APL-IP14-SCR", 1, 100, date);
        await addOrder("SAM-S23-SCR", 1, 50, date);

        // Акумулятори: 150, 80, 30.

        await addOrder("APL-IP12-BAT", 5, 30, date);
        await addOrder("APL-IP13-BAT", 2, 40, date);
        await addOrder("SAM-S23-BAT", 1, 30, date);

        // Скасоване замовлення не враховується.

        await addOrder(
            "SAM-S23-SCR",
            100,
            100,
            date,
            "cancelled",
        );

        const response = await app.inject({
            method: "GET",
            url: "/analytics/top-parts",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        const screens = rows.filter(
            (row: { category: string }) =>
                row.category === "screen",
        );

        const batteries = rows.filter(
            (row: { category: string }) =>
                row.category === "battery",
        );

        expect(screens).toHaveLength(3);
        expect(batteries).toHaveLength(3);

        const screen12 = await getPart("APL-IP12-SCR");
        const screen13 = await getPart("APL-IP13-SCR");
        const screen14 = await getPart("APL-IP14-SCR");

        const battery12 = await getPart("APL-IP12-BAT");
        const battery13 = await getPart("APL-IP13-BAT");
        const batteryS23 = await getPart("SAM-S23-BAT");

        expect(
            screens.map(
                (row: {
                    partId: number;
                    totalRevenue: string;
                    position: number;
                }) => ({
                    partId: row.partId,
                    revenue: Number(row.totalRevenue),
                    position: row.position,
                }),
            ),
        ).toEqual([
            {
                partId: screen12.id,
                revenue: 300,
                position: 1,
            },
            {
                partId: screen13.id,
                revenue: 200,
                position: 2,
            },
            {
                partId: screen14.id,
                revenue: 100,
                position: 3,
            },
        ]);

        expect(
            batteries.map(
                (row: {
                    partId: number;
                    totalRevenue: string;
                    position: number;
                }) => ({
                    partId: row.partId,
                    revenue: Number(row.totalRevenue),
                    position: row.position,
                }),
            ),
        ).toEqual([
            {
                partId: battery12.id,
                revenue: 150,
                position: 1,
            },
            {
                partId: battery13.id,
                revenue: 80,
                position: 2,
            },
            {
                partId: batteryS23.id,
                revenue: 30,
                position: 3,
            },
        ]);

        expect(rows).toHaveLength(6);
    });
});

describe("GET /analytics/monthly-sales", () => {
    it("returns an empty list when there are no orders", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/analytics/monthly-sales",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    it("calculates monthly revenue and changes from the previous month", async () => {
        // Січень: 2 * 50 + 1 * 100 = 200.

        await addOrder(
            "APL-IP12-BAT",
            2,
            50,
            "2026-01-10T12:00:00Z",
        );

        await addOrder(
            "APL-IP12-SCR",
            1,
            100,
            "2026-01-20T12:00:00Z",
        );

        // Лютий: 3 * 100 + 1 * 50 = 350.

        await addOrder(
            "APL-IP13-SCR",
            3,
            100,
            "2026-02-10T12:00:00Z",
        );

        await addOrder(
            "APL-IP13-BAT",
            1,
            50,
            "2026-02-20T12:00:00Z",
            "paid",
        );

        // Березень: 2 * 50 = 100.

        await addOrder(
            "SAM-S23-BAT",
            2,
            50,
            "2026-03-15T12:00:00Z",
        );

        // Скасоване замовлення не враховується.

        await addOrder(
            "SAM-S23-SCR",
            10,
            100,
            "2026-02-15T12:00:00Z",
            "cancelled",
        );

        const response = await app.inject({
            method: "GET",
            url: "/analytics/monthly-sales",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(
            rows.map(
                (row: {
                    month: string;
                    revenue: string;
                    changeFromPreviousMonth: string | null;
                }) => ({
                    month: row.month.slice(0, 7),

                    revenue: Number(row.revenue),

                    change:
                        row.changeFromPreviousMonth === null
                            ? null
                            : Number(row.changeFromPreviousMonth),
                }),
            ),
        ).toEqual([
            {
                month: "2026-01",
                revenue: 200,
                change: null,
            },
            {
                month: "2026-02",
                revenue: 350,
                change: 150,
            },
            {
                month: "2026-03",
                revenue: 100,
                change: -250,
            },
        ]);
    });
});