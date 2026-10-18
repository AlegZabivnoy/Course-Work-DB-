import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up" };
    } catch {
      return reply.code(503).send({ status: "error", database: "down" });
    }
  });
}