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

async function createRepair(index = 1) {
    const repair = await prisma.repairOrder.create({
        data: {
            problemDescription: "Розбитий екран",
            device: {
                create: {
                    serialNumber: `SERIAL${index}0000`,
                    model: { connect: { id: await modelIdByName("iPhone 13") } },
                    customer: {
                        create: { fullName: "Іван Петренко", phone: `+38050123456${index}` },
                    },
                },
            },
        },
    });
    return repair.id;
}

function changeStatus(id: number, payload: Record<string, unknown>) {
    return app.inject({ method: "PATCH", url: `/repairs/${id}/status`, payload });
}

function addPart(repairId: number, partId: number, quantity: number) {
    return app.inject({
        method: "POST",
        url: `/repairs/${repairId}/parts`,
        payload: { partId, quantity },
    });
}

describe("PATCH /repairs/:id/status", () => {
    it("walks through the full workflow and sets completedAt on ready", async () => {
        const repairId = await createRepair();
        const technician = await prisma.technician.findFirstOrThrow();

        const diagnosing = await changeStatus(repairId, {
            status: "diagnosing",
            version: 0,
            technicianId: technician.id,
        });
        expect(diagnosing.statusCode).toBe(200);
        expect(diagnosing.json().status).toBe("diagnosing");
        expect(diagnosing.json().version).toBe(1);

        const inRepair = await changeStatus(repairId, { status: "in_repair", version: 1 });
        expect(inRepair.json().status).toBe("in_repair");
        expect(inRepair.json().completedAt).toBeNull();

        const ready = await changeStatus(repairId, { status: "ready", version: 2, laborCost: 500 });
        expect(ready.json().status).toBe("ready");
        expect(Number(ready.json().laborCost)).toBe(500);
        expect(ready.json().completedAt).not.toBeNull();

        const issued = await changeStatus(repairId, { status: "issued", version: 3 });
        expect(issued.statusCode).toBe(200);
        expect(issued.json().status).toBe("issued");
        expect(issued.json().version).toBe(4);
    });

    it("rejects a forbidden transition with 409", async () => {
        const repairId = await createRepair();

        const response = await changeStatus(repairId, { status: "ready", version: 0 });

        expect(response.statusCode).toBe(409);
        const repair = await prisma.repairOrder.findUniqueOrThrow({ where: { id: repairId } });
        expect(repair.status).toBe("received");
        expect(repair.version).toBe(0);
    });

    it("requires a technician before diagnosis", async () => {
        const repairId = await createRepair();

        const response = await changeStatus(repairId, { status: "diagnosing", version: 0 });

        expect(response.statusCode).toBe(409);
        expect((await prisma.repairOrder.findUniqueOrThrow({ where: { id: repairId } })).status).toBe("received");
    });

    it("returns 404 for an unknown technician", async () => {
        const repairId = await createRepair();

        const response = await changeStatus(repairId, {
            status: "diagnosing",
            version: 0,
            technicianId: 99999,
        });

        expect(response.statusCode).toBe(404);
    });

    it("detects a stale version (optimistic locking)", async () => {
        const repairId = await createRepair();
        const technician = await prisma.technician.findFirstOrThrow();

        const first = await changeStatus(repairId, {
            status: "diagnosing",
            version: 0,
            technicianId: technician.id,
        });
        expect(first.statusCode).toBe(200);

        const stale = await changeStatus(repairId, { status: "cancelled", version: 0 });

        expect(stale.statusCode).toBe(409);
        const repair = await prisma.repairOrder.findUniqueOrThrow({ where: { id: repairId } });
        expect(repair.status).toBe("diagnosing");
        expect(repair.version).toBe(1);
    });

    it("returns 400 for an unknown status value", async () => {
        const repairId = await createRepair();

        const response = await changeStatus(repairId, { status: "exploded", version: 0 });

        expect(response.statusCode).toBe(400);
    });

    it("returns 404 for an unknown repair", async () => {
        const response = await changeStatus(99999, { status: "cancelled", version: 0 });

        expect(response.statusCode).toBe(404);
    });

    it("returns parts to stock when a repair is cancelled", async () => {
        const repairId = await createRepair();
        const part = await partBySku("APL-IP13-SCR");

        await addPart(repairId, part.id, 3);
        expect((await partBySku("APL-IP13-SCR")).stockQty).toBe(part.stockQty - 3);

        const response = await changeStatus(repairId, { status: "cancelled", version: 0 });

        expect(response.statusCode).toBe(200);
        expect((await partBySku("APL-IP13-SCR")).stockQty).toBe(part.stockQty);
    });
});

describe("DELETE /repairs/:id", () => {
    it("deletes a cancelled repair together with its part rows", async () => {
        const repairId = await createRepair();
        const part = await partBySku("APL-IP13-SCR");
        await addPart(repairId, part.id, 2);
        await changeStatus(repairId, { status: "cancelled", version: 0 });

        const response = await app.inject({ method: "DELETE", url: `/repairs/${repairId}` });

        expect(response.statusCode).toBe(204);
        expect(await prisma.repairOrder.count()).toBe(0);
        expect(await prisma.repairOrderPart.count()).toBe(0);
        expect((await partBySku("APL-IP13-SCR")).stockQty).toBe(part.stockQty);
    });

    it("refuses to delete a repair that is not cancelled", async () => {
        const repairId = await createRepair();

        const response = await app.inject({ method: "DELETE", url: `/repairs/${repairId}` });

        expect(response.statusCode).toBe(409);
        expect(await prisma.repairOrder.count()).toBe(1);
    });

    it("returns 404 for an unknown repair", async () => {
        const response = await app.inject({ method: "DELETE", url: "/repairs/99999" });

        expect(response.statusCode).toBe(404);
    });
});

describe("concurrent requests", () => {
    it("two simultaneous requests cannot take the same last parts (row locking)", async () => {
        const firstRepair = await createRepair(1);
        const secondRepair = await createRepair(2);
        const part = await partBySku("APL-IP13-SCR");

        const [a, b] = await Promise.all([
            addPart(firstRepair, part.id, 5),
            addPart(secondRepair, part.id, 5),
        ]);

        expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
        expect((await partBySku("APL-IP13-SCR")).stockQty).toBe(part.stockQty - 5);
        expect(await prisma.repairOrderPart.count()).toBe(1);
    });
});