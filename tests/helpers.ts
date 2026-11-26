import { seedReferenceData } from "../prisma/seed-data";
import { prisma } from "../src/db/prisma";

export async function resetDb() {
    const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    if (!dbName.endsWith("_test")) {
        throw new Error(`Refusing to reset non-test database "${dbName}"`);
    }

    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

    const originalLog = console.log;
    console.log = () => {};
    try {
        await seedReferenceData();
    } finally {
        console.log = originalLog;
    }
}