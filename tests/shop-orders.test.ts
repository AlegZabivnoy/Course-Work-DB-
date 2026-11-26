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

async function createOrder(
    items: { partId: number; quantity: number }[],
) {
    return app.inject({
        method: "POST",
        url: "/shop-orders",
        payload: {
            customerId,
            items,
        },
    });
}

describe("POST /shop-orders", () => {
    it("creates an order with items and decreases stock", async () => {
        const battery = await getPart("APL-IP12-BAT");
        const screen = await getPart("APL-IP12-SCR");

        const response = await createOrder([
            { partId: battery.id, quantity: 2 },
            { partId: screen.id, quantity: 1 },
            { partId: battery.id, quantity: 1 },
        ]);

        expect(response.statusCode).toBe(201);

        const order = response.json();

        expect(order.customerId).toBe(customerId);
        expect(order.status).toBe("new");
        expect(order.items).toHaveLength(2);

        const savedOrder = await prisma.shopOrder.findUniqueOrThrow({
            where: { id: order.id },
            include: { items: true },
        });

        const batteryItem = savedOrder.items.find(
            (item) => item.partId === battery.id,
        );

        const screenItem = savedOrder.items.find(
            (item) => item.partId === screen.id,
        );

        expect(batteryItem?.quantity).toBe(3);
        expect(screenItem?.quantity).toBe(1);

        expect(batteryItem?.unitPrice.toString()).toBe(
            battery.price.toString(),
        );

        expect(screenItem?.unitPrice.toString()).toBe(
            screen.price.toString(),
        );

        expect(
            (await getPart(battery.sku)).stockQty,
        ).toBe(battery.stockQty - 3);

        expect(
            (await getPart(screen.sku)).stockQty,
        ).toBe(screen.stockQty - 1);
    });

    it("returns 409 and preserves all data when stock is insufficient", async () => {
        const battery = await getPart("APL-IP12-BAT");
        const screen = await getPart("APL-IP12-SCR");

        const response = await createOrder([
            { partId: battery.id, quantity: 1 },
            {
                partId: screen.id,
                quantity: screen.stockQty + 1,
            },
        ]);

        expect(response.statusCode).toBe(409);

        expect(await prisma.shopOrder.count()).toBe(0);
        expect(await prisma.shopOrderItem.count()).toBe(0);

        expect(
            (await getPart(battery.sku)).stockQty,
        ).toBe(battery.stockQty);

        expect(
            (await getPart(screen.sku)).stockQty,
        ).toBe(screen.stockQty);
    });

    it("returns 404 for an unknown part without partial changes", async () => {
        const battery = await getPart("APL-IP12-BAT");

        const response = await createOrder([
            { partId: battery.id, quantity: 1 },
            { partId: 999999, quantity: 1 },
        ]);

        expect(response.statusCode).toBe(404);

        expect(await prisma.shopOrder.count()).toBe(0);
        expect(await prisma.shopOrderItem.count()).toBe(0);

        expect(
            (await getPart(battery.sku)).stockQty,
        ).toBe(battery.stockQty);
    });

    it("prevents overselling during concurrent orders", async () => {
        const battery = await getPart("APL-IP12-BAT");
        const screen = await getPart("APL-IP12-SCR");

        await prisma.part.update({
            where: { id: screen.id },
            data: { stockQty: 1 },
        });

        const items = [
            { partId: battery.id, quantity: 1 },
            { partId: screen.id, quantity: 1 },
        ];

        const responses = await Promise.all([
            createOrder(items),
            createOrder(items),
        ]);

        const statuses = responses
            .map((response) => response.statusCode)
            .sort((a, b) => a - b);

        expect(statuses).toEqual([201, 409]);

        expect(await prisma.shopOrder.count()).toBe(1);
        expect(await prisma.shopOrderItem.count()).toBe(2);

        expect(
            (await getPart(screen.sku)).stockQty,
        ).toBe(0);

        expect(
            (await getPart(battery.sku)).stockQty,
        ).toBe(battery.stockQty - 1);
    });
});