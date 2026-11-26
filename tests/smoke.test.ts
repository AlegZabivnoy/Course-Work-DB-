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

describe("test infrastructure", () => {
    it("health endpoint answers", async () => {
        const response = await app.inject({ method: "GET", url: "/health" });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: "ok", database: "up" });
    });

    it("reference data is loaded before each test", async () => {
        expect(await prisma.deviceModel.count()).toBe(31);
        expect(await prisma.part.count()).toBe(8);
        expect(await prisma.customer.count()).toBe(0);
    });
});