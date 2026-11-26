import { execSync } from "node:child_process";
import pg from "pg";
import { adminUrl, testDbName, testUrl } from "./test-db";

export default async function setup() {
    const client = new pg.Client({ connectionString: adminUrl });
    await client.connect();
    try {
        const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDbName]);
        if (exists.rowCount === 0) {
            await client.query(`CREATE DATABASE "${testDbName}"`);
        }
    } finally {
        await client.end();
    }

    execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: testUrl },
    });
}