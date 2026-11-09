import Fastify from "fastify";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "./errors";
import { healthRoutes } from "./routes/health";
import { customerRoutes } from "./routes/customers";
import { partRoutes } from "./routes/parts";
import { repairRoutes } from "./routes/repairs";
import { shopOrderRoutes } from "./routes/shop-orders";
import { analyticsRoutes } from "./routes/analytics";

function isCheckConstraintError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const seen = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const value = current as {
      code?: unknown;
      originalCode?: unknown;
      cause?: unknown;
      meta?: unknown;
    };
    if (value.code === "23514" || value.originalCode === "23514") {
      return true;
    }
    if (value.cause) {
      pending.push(value.cause);
    }
    if (value.meta) {
      pending.push(value.meta);
    }
  }

  return false;
}

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as Error & { statusCode?: number };
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.code(fastifyError.statusCode).send({
        error: fastifyError.name,
        message: fastifyError.message,
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "ValidationError",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.name, message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002" || error.code === "P2003") {
        return reply.code(409).send({ error: "Conflict", message: "Record conflicts with existing data" });
      }
      if (error.code === "P2025") {
        return reply.code(404).send({ error: "NotFound", message: "Record not found" });
      }
    }
    if (isCheckConstraintError(error)) {
      return reply.code(400).send({ error: "ValidationError", message: "A database constraint was violated" });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "InternalServerError", message: "Internal server error" });
  });

  app.register(healthRoutes);
  app.register(repairRoutes);
  app.register(shopOrderRoutes);
  app.register(partRoutes);
  app.register(customerRoutes);
  app.register(analyticsRoutes);

  return app;
}
