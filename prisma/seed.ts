import { prisma } from "../src/db/prisma";

const catalog = [
    {
        brand: "Apple",
        models: [
            { name: "iPhone 11", releaseYear: 2019 },
            { name: "iPhone 11 Pro", releaseYear: 2019 },
            { name: "iPhone 12", releaseYear: 2020 },
            { name: "iPhone 12 Pro", releaseYear: 2020 },
            { name: "iPhone 13", releaseYear: 2021 },
            { name: "iPhone 13 Pro", releaseYear: 2021 },
            { name: "iPhone 14", releaseYear: 2022 },
            { name: "iPhone 14 Pro", releaseYear: 2022 },
            { name: "iPhone 15", releaseYear: 2023 },
            { name: "iPhone 15 Pro", releaseYear: 2023 },
            { name: "iPhone 16", releaseYear: 2024 },
            { name: "iPhone 16 Pro", releaseYear: 2024 },
            { name: "iPhone 17", releaseYear: 2025 },
            { name: "iPhone 17 Pro", releaseYear: 2025 },
        ],
    },
    {
        brand: "Samsung",
        models: [
            { name: "Galaxy S20", releaseYear: 2020 },
            { name: "Galaxy S20 Ultra", releaseYear: 2020 },
            { name: "Galaxy S21", releaseYear: 2021 },
            { name: "Galaxy S21 Ultra", releaseYear: 2021 },
            { name: "Galaxy S22", releaseYear: 2022 },
            { name: "Galaxy S22 Ultra", releaseYear: 2022 },
            { name: "Galaxy S23", releaseYear: 2023 },
            { name: "Galaxy S23 Ultra", releaseYear: 2023 },
            { name: "Galaxy S24", releaseYear: 2024 },
            { name: "Galaxy S24 Ultra", releaseYear: 2024 },
            { name: "Galaxy S25", releaseYear: 2025 },
            { name: "Galaxy S25 Ultra", releaseYear: 2025 },
            { name: "Galaxy A54", releaseYear: 2023 },
            { name: "Galaxy A55", releaseYear: 2024 },
            { name: "Galaxy A56", releaseYear: 2025 },
            { name: "Galaxy Z Flip6", releaseYear: 2024 },
            { name: "Galaxy Z Fold6", releaseYear: 2024 },
        ],
    },
];

const technicians = [
    { fullName: "Андрій Мельник", hiredAt: new Date("2021-03-15") },
    { fullName: "Ірина Бондаренко", hiredAt: new Date("2022-09-01") },
    { fullName: "Максим Ткаченко", hiredAt: new Date("2024-02-10") },
];

const parts = [
    { sku: "APL-IP13-SCR", name: "iPhone 13 OLED display", partType: "screen" as const, price: "89.99", stockQty: 8, brand: "Apple", models: ["iPhone 13", "iPhone 13 Pro"] },
    { sku: "APL-IP13-BAT", name: "iPhone 13 battery", partType: "battery" as const, price: "29.50", stockQty: 15, brand: "Apple", models: ["iPhone 13"] },
    { sku: "APL-IP14-SCR", name: "iPhone 14 display", partType: "screen" as const, price: "109.00", stockQty: 6, brand: "Apple", models: ["iPhone 14", "iPhone 14 Pro"] },
    { sku: "SAM-S23-SCR", name: "Galaxy S23 display assembly", partType: "screen" as const, price: "119.00", stockQty: 5, brand: "Samsung", models: ["Galaxy S23", "Galaxy S23 Ultra"] },
    { sku: "SAM-S23-BAT", name: "Galaxy S23 battery", partType: "battery" as const, price: "34.00", stockQty: 12, brand: "Samsung", models: ["Galaxy S23"] },
    { sku: "SAM-A54-CHG", name: "Galaxy A54 charging port", partType: "charging_port" as const, price: "22.00", stockQty: 10, brand: "Samsung", models: ["Galaxy A54"] },
];

async function seedBrandsAndModels() {
    for (const entry of catalog) {
        const brand = await prisma.brand.upsert({
            where: { name: entry.brand },
            update: {},
            create: { name: entry.brand },
        });

        for (const model of entry.models) {
            await prisma.deviceModel.upsert({
                where: { brandId_name: { brandId: brand.id, name: model.name } },
                update: { releaseYear: model.releaseYear },
                create: {
                    brandId: brand.id,
                    name: model.name,
                    releaseYear: model.releaseYear,
                },
            });
        }

        console.log(`✓ ${entry.brand}: ${entry.models.length} models`);
    }
}

async function seedTechnicians() {
    const existing = await prisma.technician.count();

    if (existing > 0) {
        console.log(`✓ Technicians already exist (${existing}), skipped`);
        return;
    }

    await prisma.technician.createMany({ data: technicians });
    console.log(`✓ Technicians: ${technicians.length} created`);
}

async function seedParts() {
    for (const entry of parts) {
        const part = await prisma.part.upsert({
            where: { sku: entry.sku },
            update: { name: entry.name, partType: entry.partType },
            create: { sku: entry.sku, name: entry.name, partType: entry.partType, price: entry.price, stockQty: entry.stockQty },
        });
        const brand = await prisma.brand.findUniqueOrThrow({ where: { name: entry.brand } });
        for (const modelName of entry.models) {
            const model = await prisma.deviceModel.findUniqueOrThrow({ where: { brandId_name: { brandId: brand.id, name: modelName } } });
            await prisma.partCompatibility.upsert({
                where: { partId_modelId: { partId: part.id, modelId: model.id } },
                update: {},
                create: { partId: part.id, modelId: model.id },
            });
        }
    }
    console.log(`Parts and compatibility: ${parts.length} seeded`);
}

async function main() {
    await seedBrandsAndModels();
    await seedTechnicians();
    await seedParts();
}

main()
    .then(() => console.log("Seed completed"))
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
