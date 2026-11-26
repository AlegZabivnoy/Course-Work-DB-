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

async function getPart(sku: string) {
    return prisma.part.findUniqueOrThrow({
        where: { sku },
    });
}

describe("PATCH /parts/:id", () => {
    it("updates price and stock and increments version", async () => {
        const part = await getPart("APL-IP12-BAT");

        const response = await app.inject({
            method: "PATCH",
            url: `/parts/${part.id}`,
            payload: {
                version: part.version,
                price: 35.50,
                stockQty: 25,
            },
        });

        expect(response.statusCode).toBe(200);

        const updated = await getPart(part.sku);

        expect(Number(updated.price)).toBe(35.50);
        expect(updated.stockQty).toBe(25);
        expect(updated.version).toBe(part.version + 1);
    });

    it("rejects an outdated version with 409", async () => {
        const part = await getPart("APL-IP12-BAT");

        const firstResponse = await app.inject({
            method: "PATCH",
            url: `/parts/${part.id}`,
            payload: {
                version: part.version,
                price: 40,
                stockQty: 20,
            },
        });

        expect(firstResponse.statusCode).toBe(200);

        const secondResponse = await app.inject({
            method: "PATCH",
            url: `/parts/${part.id}`,
            payload: {
                version: part.version,
                price: 10,
                stockQty: 1,
            },
        });

        expect(secondResponse.statusCode).toBe(409);

        const updated = await getPart(part.sku);

        expect(Number(updated.price)).toBe(40);
        expect(updated.stockQty).toBe(20);
        expect(updated.version).toBe(part.version + 1);
    });

    it("returns 404 for an unknown part", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: "/parts/999999",
            payload: {
                version: 0,
                price: 50,
            },
        });

        expect(response.statusCode).toBe(404);
    });

    it("rejects a negative stock quantity", async () => {
        const part = await getPart("APL-IP12-BAT");

        const response = await app.inject({
            method: "PATCH",
            url: `/parts/${part.id}`,
            payload: {
                version: part.version,
                stockQty: -1,
            },
        });

        expect(response.statusCode).toBe(400);

        const updated = await getPart(part.sku);

        expect(updated.stockQty).toBe(part.stockQty);
        expect(updated.version).toBe(part.version);
    });
});

describe("GET /parts", () => {
    it("returns only parts compatible with the selected model", async () => {
        const model = await prisma.deviceModel.findFirstOrThrow({
            where: { name: "iPhone 12" },
        });

        const response = await app.inject({
            method: "GET",
            url: `/parts?modelId=${model.id}&sort=asc`,
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(
            rows.map((part: { sku: string }) => part.sku),
        ).toEqual([
            "APL-IP12-BAT",
            "APL-IP12-SCR",
        ]);
    });

    it("filters parts by category and sorts by price", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/parts?type=screen&sort=desc",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(
            rows.map((part: { sku: string }) => part.sku),
        ).toEqual([
            "SAM-S23-SCR",
            "APL-IP14-SCR",
            "APL-IP13-SCR",
            "APL-IP12-SCR",
        ]);
    });

    it("supports pagination", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/parts?type=screen&sort=asc&page=2&pageSize=1",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(rows).toHaveLength(1);
        expect(rows[0].sku).toBe("APL-IP13-SCR");
    });

    it("excludes soft-deleted parts", async () => {
        const part = await getPart("APL-IP12-BAT");

        await prisma.part.update({
            where: { id: part.id },
            data: { deletedAt: new Date() },
        });

        const response = await app.inject({
            method: "GET",
            url: "/parts",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(
            rows.some(
                (item: { id: number }) => item.id === part.id,
            ),
        ).toBe(false);
    });
});

describe("GET /parts/search", () => {
    it("searches part names without case sensitivity", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/parts/search?q=BATTERY",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(
            rows.map((part: { sku: string }) => part.sku).sort(),
        ).toEqual([
            "APL-IP12-BAT",
            "APL-IP13-BAT",
            "SAM-S23-BAT",
        ]);
    });

    it("excludes deleted parts from search results", async () => {
        const part = await getPart("APL-IP12-BAT");

        await prisma.part.update({
            where: { id: part.id },
            data: { deletedAt: new Date() },
        });

        const response = await app.inject({
            method: "GET",
            url: "/parts/search?q=battery",
        });

        expect(response.statusCode).toBe(200);

        const rows = response.json();

        expect(rows).toHaveLength(2);

        expect(
            rows.some(
                (item: { id: number }) => item.id === part.id,
            ),
        ).toBe(false);
    });

    it("returns an empty list when nothing matches", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/parts/search?q=unknownpart123",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });
});