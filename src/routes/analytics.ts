import type { FastifyInstance } from "fastify";
import { getMonthlySales, getTopPartsByCategory } from "../repositories/analytics.repository";

export async function analyticsRoutes(app: FastifyInstance) {
    app.get("/analytics/top-parts", async () => getTopPartsByCategory());
    app.get("/analytics/monthly-sales", async () => getMonthlySales());
}
