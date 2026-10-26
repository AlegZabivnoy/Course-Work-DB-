import Fastify from "fastify";
import { healthRoutes } from "./routes/health";
import { repairRoutes } from "./routes/repairs";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(healthRoutes);
  app.register(repairRoutes);

  return app;
}