import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { resetDb } from "./helpers";

const app = buildApp();

beforeAll(async () => {
    await app.ready();
});

afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
});

beforeEach(async () => {
    await resetDb();
});

async function modelIdByName(name: string) {
    const model = await prisma.deviceModel.findFirstOrThrow({ where: { name } });
    return model.id;
}

function partBySku(sku: string) {
    return prisma.part.findUniqueOrThrow({ where: { sku } });
}

// Отправляет POST /repairs. Любые поля можно переопределить через overrides.
async function acceptRepair(overrides: Record<string, unknown> = {}) {
    return app.inject({
        method: "POST",
        url: "/repairs",
        payload: {
            customer: { fullName: "Іван Петренко", phone: "+380501234567" },
            device: { modelId: await modelIdByName("iPhone 13"), serialNumber: "abc12345" },
            problemDescription: "Розбитий екран",
            ...overrides,
        },
    });
}

describe("POST /repairs (accept a repair)", () => {
    it("creates customer, device and repair order in one request", async () => {
        const response = await acceptRepair();

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.status).toBe("received");
        expect(body.version).toBe(0);
        expect(body.device.serialNumber).toBe("ABC12345");
        expect(body.device.customer.phone).toBe("+380501234567");

        expect(await prisma.customer.count()).toBe(1);
        expect(await prisma.device.count()).toBe(1);
        expect(await prisma.repairOrder.count()).toBe(1);
    });

    it("normalizes the phone number", async () => {
        const response = await acceptRepair({
            customer: { fullName: "Іван Петренко", phone: "+38 (050) 123-45-67" },
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().device.customer.phone).toBe("+380501234567");
    });

    it("reuses an existing customer for a second device", async () => {
        await acceptRepair();
        const second = await acceptRepair({
            device: { modelId: await modelIdByName("iPhone 14"), serialNumber: "XYZ98765" },
        });

        expect(second.statusCode).toBe(201);
        expect(await prisma.customer.count()).toBe(1);
        expect(await prisma.device.count()).toBe(2);
        expect(await prisma.repairOrder.count()).toBe(2);
    });

    it("rejects an invalid phone with 400 and saves nothing", async () => {
        const response = await acceptRepair({
            customer: { fullName: "Іван Петренко", phone: "123" },
        });

        expect(response.statusCode).toBe(400);
        expect(await prisma.customer.count()).toBe(0);
    });

    it("returns 404 for an unknown device model and saves nothing", async () => {
        const response = await acceptRepair({
            device: { modelId: 99999, serialNumber: "ABC12345" },
        });

        expect(response.statusCode).toBe(404);
        expect(await prisma.customer.count()).toBe(0);
        expect(await prisma.device.count()).toBe(0);
    });

    it("rolls back the whole transaction when the serial belongs to another customer", async () => {
        await acceptRepair();

        const response = await acceptRepair({
            customer: { fullName: "Олена Коваль", phone: "+380671112233" },
        });

        expect(response.statusCode).toBe(409);
        // Новый клиент создавался внутри транзакции, но после отката его быть не должно
        expect(await prisma.customer.count()).toBe(1);
        expect(await prisma.device.count()).toBe(1);
        expect(await prisma.repairOrder.count()).toBe(1);
    });
});

describe("POST /repairs/:id/parts (add a part)", () => {
    async function createRepairForIphone13() {
        const response = await acceptRepair();
        return response.json().id as number;
    }

    it("adds a compatible part, decreases stock and snapshots the price", async () => {
        const repairId = await createRepairForIphone13();
        const part = await partBySku("APL-IP13-SCR");

        const response = await app.inject({
            method: "POST",
            url: `/repairs/${repairId}/parts`,
            payload: { partId: part.id, quantity: 2 },
        });

        expect(response.statusCode).toBe(200);
        const item = response.json().parts[0];
        expect(item.quantity).toBe(2);
        expect(item.unitPrice).toBe("89.99");

        const after = await partBySku("APL-IP13-SCR");
        expect(after.stockQty).toBe(part.stockQty - 2);
        expect(after.version).toBe(part.version + 1);
    });

    it("adding the same part twice increases the quantity of one row", async () => {
        const repairId = await createRepairForIphone13();
        const part = await partBySku("APL-IP13-BAT");

        for (let i = 0; i < 2; i++) {
            await app.inject({
                method: "POST",
                url: `/repairs/${repairId}/parts`,
                payload: { partId: part.id, quantity: 1 },
            });
        }

        const rows = await prisma.repairOrderPart.findMany({ where: { orderId: repairId } });
        expect(rows).toHaveLength(1);
        expect(rows[0].quantity).toBe(2);
        expect((await partBySku("APL-IP13-BAT")).stockQty).toBe(part.stockQty - 2);
    });

    it("returns 409 on insufficient stock and changes nothing", async () => {
        const repairId = await createRepairForIphone13();
        const part = await partBySku("APL-IP13-SCR"); // на складе 8

        const response = await app.inject({
            method: "POST",
            url: `/repairs/${repairId}/parts`,
            payload: { partId: part.id, quantity: 10 },
        });

        expect(response.statusCode).toBe(409);
        expect((await partBySku("APL-IP13-SCR")).stockQty).toBe(part.stockQty);
        expect(await prisma.repairOrderPart.count()).toBe(0);
    });

    it("returns 409 for a part that is not compatible with the device model", async () => {
        const repairId = await createRepairForIphone13();
        const samsungScreen = await partBySku("SAM-S23-SCR");

        const response = await app.inject({
            method: "POST",
            url: `/repairs/${repairId}/parts`,
            payload: { partId: samsungScreen.id, quantity: 1 },
        });

        expect(response.statusCode).toBe(409);
        expect((await partBySku("SAM-S23-SCR")).stockQty).toBe(samsungScreen.stockQty);
        expect(await prisma.repairOrderPart.count()).toBe(0);
    });

    it("returns 409 when the repair is already cancelled", async () => {
        const repairId = await createRepairForIphone13();
        await app.inject({
            method: "PATCH",
            url: `/repairs/${repairId}/status`,
            payload: { status: "cancelled", version: 0 },
        });
        const part = await partBySku("APL-IP13-SCR");

        const response = await app.inject({
            method: "POST",
            url: `/repairs/${repairId}/parts`,
            payload: { partId: part.id, quantity: 1 },
        });

        expect(response.statusCode).toBe(409);
        expect((await partBySku("APL-IP13-SCR")).stockQty).toBe(part.stockQty);
    });

    it("returns 404 for an unknown repair", async () => {
        const part = await partBySku("APL-IP13-SCR");

        const response = await app.inject({
            method: "POST",
            url: "/repairs/99999/parts",
            payload: { partId: part.id, quantity: 1 },
        });

        expect(response.statusCode).toBe(404);
    });
});