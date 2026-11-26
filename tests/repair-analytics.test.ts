import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import type { RepairStatus } from "../generated/prisma/client";
import { resetDb } from "./helpers";

const app = buildApp();

beforeAll(async () => {
    await app.ready();
});

afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
});

let customerId: number;
let serialCounter: number;

beforeEach(async () => {
    await resetDb();
    serialCounter = 0;
    const customer = await prisma.customer.create({
        data: { fullName: "Іван Петренко", phone: "+380501234567" },
    });
    customerId = customer.id;
});

const CREATED_AT = new Date("2026-01-01T10:00:00Z");

async function addRepair(
    modelName: string,
    options: { status: RepairStatus; days?: number; laborCost?: number },
) {
    const model = await prisma.deviceModel.findFirstOrThrow({ where: { name: modelName } });
    serialCounter += 1;

    await prisma.repairOrder.create({
        data: {
            status: options.status,
            problemDescription: "Тестова поломка",
            laborCost: options.laborCost ?? 0,
            createdAt: CREATED_AT,
            completedAt:
                options.days === undefined
                    ? null
                    : new Date(CREATED_AT.getTime() + options.days * 24 * 60 * 60 * 1000),
            device: {
                create: {
                    serialNumber: `TEST${serialCounter}0000`,
                    customer: { connect: { id: customerId } },
                    model: { connect: { id: model.id } },
                },
            },
        },
    });
}

async function createScenario() {
    await addRepair("iPhone 13", { status: "issued", days: 2, laborCost: 300 });
    await addRepair("iPhone 13", { status: "issued", days: 4, laborCost: 500 });
    await addRepair("iPhone 13", { status: "cancelled" });
    await addRepair("Galaxy S23", { status: "issued", days: 1, laborCost: 100 });
    await addRepair("Galaxy S23", { status: "ready", days: 1, laborCost: 200 });
    await addRepair("iPhone 14", { status: "received" });
}

async function getReliability(query = "") {
    return app.inject({ method: "GET", url: `/analytics/model-reliability${query}` });
}

describe("GET /analytics/model-reliability", () => {
    it("returns an empty list when there are no repairs", async () => {
        const response = await getReliability("?minRepairs=1");

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    it("calculates count, average repair time and average labor cost", async () => {
        await createScenario();

        const rows = (await getReliability()).json();

        const iphone13 = rows.find((row: { model: string }) => row.model === "iPhone 13");
        expect(iphone13).toEqual({
            brand: "Apple",
            model: "iPhone 13",
            repairsCount: 2,
            avgRepairDays: 3,
            avgLaborCost: 400,
            rankInBrand: 1,
        });

        const galaxy = rows.find((row: { model: string }) => row.model === "Galaxy S23");
        expect(galaxy).toMatchObject({
            brand: "Samsung",
            repairsCount: 2,
            avgRepairDays: 1,
            avgLaborCost: 150,
            rankInBrand: 1,
        });
    });

    it("hides models below the minRepairs threshold (HAVING)", async () => {
        await createScenario();

        const byDefault = (await getReliability()).json();
        expect(byDefault.map((row: { model: string }) => row.model)).toEqual(["Galaxy S23", "iPhone 13"]);

        const all = (await getReliability("?minRepairs=1")).json();
        expect(all.map((row: { model: string }) => row.model)).toEqual(["Galaxy S23", "iPhone 13", "iPhone 14"]);
    });

    it("ranks models inside their own brand", async () => {
        await createScenario();

        const rows = (await getReliability("?minRepairs=1")).json();

        const rank = (model: string) =>
            rows.find((row: { model: string }) => row.model === model).rankInBrand;
        expect(rank("iPhone 13")).toBe(1);
        expect(rank("iPhone 14")).toBe(2);
        expect(rank("Galaxy S23")).toBe(1);
    });

    it("returns null average time for a model with no finished repairs", async () => {
        await createScenario();

        const rows = (await getReliability("?minRepairs=1")).json();

        const iphone14 = rows.find((row: { model: string }) => row.model === "iPhone 14");
        expect(iphone14.repairsCount).toBe(1);
        expect(iphone14.avgRepairDays).toBeNull();
    });

    it("rejects an invalid threshold with 400", async () => {
        const response = await getReliability("?minRepairs=0");

        expect(response.statusCode).toBe(400);
    });
});