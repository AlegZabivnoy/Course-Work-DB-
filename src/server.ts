import { buildApp } from "./app";
import { prisma } from "./db/prisma";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);