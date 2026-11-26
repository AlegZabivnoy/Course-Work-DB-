import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getMonthlySales, getTopPartsByCategory } from "../repositories/analytics.repository";
import { getModelReliability } from "../repositories/repair-analytics.repository";

const reliabilityQuery = z.object({
    minRepairs: z.coerce.number().int().min(1).default(2),
});

export async function analyticsRoutes(app: FastifyInstance) {
    app.get("/analytics/top-parts", async () => getTopPartsByCategory());
    app.get("/analytics/monthly-sales", async () => getMonthlySales());

    app.get("/analytics/model-reliability", async (request) => {
        const { minRepairs } = reliabilityQuery.parse(request.query);
        return getModelReliability(minRepairs);
    });
}