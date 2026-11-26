import "dotenv/config";

const baseUrl = process.env.DATABASE_URL;

if (!baseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
}

const url = new URL(baseUrl);

export const testDbName = `${url.pathname.slice(1)}_test`;

// Адрес для pg-клиента: к основной базе, без параметра ?schema
const admin = new URL(baseUrl);
admin.search = "";
export const adminUrl = admin.toString();

// Адрес тестовой базы (для Prisma, с ?schema=public)
url.pathname = `/${testDbName}`;
export const testUrl = url.toString();