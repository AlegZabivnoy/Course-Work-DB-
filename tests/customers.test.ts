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

describe("DELETE /customers/:id", () => {
    it("soft-deletes a customer and preserves related records", async () => {
        const model = await prisma.deviceModel.findFirstOrThrow({
            where: { name: "iPhone 12" },
        });

        const device = await prisma.device.create({
            data: {
                customerId,
                modelId: model.id,
                serialNumber: "TEST-DEVICE-001",
            },
        });

        const order = await prisma.shopOrder.create({
            data: { customerId },
        });

        const response = await app.inject({
            method: "DELETE",
            url: `/customers/${customerId}`,
        });

        expect(response.statusCode).toBe(204);

        const customer = await prisma.customer.findUniqueOrThrow({
            where: { id: customerId },
        });

        expect(customer.deletedAt).toBeInstanceOf(Date);

        expect(
            customer.deletedAt!.getTime(),
        ).toBeGreaterThanOrEqual(customer.createdAt.getTime());

        expect(await prisma.customer.count()).toBe(1);

        expect(
            await prisma.device.findUnique({
                where: { id: device.id },
            }),
        ).not.toBeNull();

        expect(
            await prisma.shopOrder.findUnique({
                where: { id: order.id },
            }),
        ).not.toBeNull();
    });

    it("returns 404 when deleting an already deleted customer", async () => {
        const firstResponse = await app.inject({
            method: "DELETE",
            url: `/customers/${customerId}`,
        });

        expect(firstResponse.statusCode).toBe(204);

        const secondResponse = await app.inject({
            method: "DELETE",
            url: `/customers/${customerId}`,
        });

        expect(secondResponse.statusCode).toBe(404);
    });

    it("returns 404 for an unknown customer", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: "/customers/999999",
        });

        expect(response.statusCode).toBe(404);
    });

    it("prevents deleted customers from creating new shop orders", async () => {
        const part = await prisma.part.findUniqueOrThrow({
            where: { sku: "APL-IP12-BAT" },
        });

        await prisma.customer.update({
            where: { id: customerId },
            data: { deletedAt: new Date() },
        });

        const response = await app.inject({
            method: "POST",
            url: "/shop-orders",
            payload: {
                customerId,
                items: [
                    {
                        partId: part.id,
                        quantity: 1,
                    },
                ],
            },
        });

        expect(response.statusCode).toBe(404);

        expect(await prisma.shopOrder.count()).toBe(0);
        expect(await prisma.shopOrderItem.count()).toBe(0);

        const updatedPart = await prisma.part.findUniqueOrThrow({
            where: { id: part.id },
        });

        expect(updatedPart.stockQty).toBe(part.stockQty);
    });

    it("does not return devices of a deleted customer", async () => {
        await prisma.customer.update({
            where: { id: customerId },
            data: { deletedAt: new Date() },
        });

        const response = await app.inject({
            method: "GET",
            url: `/customers/${customerId}/devices`,
        });

        expect(response.statusCode).toBe(404);
    });
});