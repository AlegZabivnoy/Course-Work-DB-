import { prisma } from "../src/db/prisma";
import {
    Prisma,
    type RepairStatus,
    type ShopOrderStatus,
} from "../generated/prisma/client";

const DEMO_PHONE = "+380990000001";
const DAY = 24 * 60 * 60 * 1000;

let randomSeed = 42;

function random(): number {
    randomSeed =
        (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;

    return randomSeed / 4294967296;
}

function randomInt(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
    return items[randomInt(0, items.length - 1)];
}

const firstNames = [
    "Олександр",
    "Андрій",
    "Максим",
    "Дмитро",
    "Іван",
    "Олена",
    "Анна",
    "Марія",
    "Ірина",
    "Софія",
];

const lastNames = [
    "Шевченко",
    "Коваленко",
    "Бондаренко",
];

const problems = [
    "Пошкоджений дисплей",
    "Швидко розряджається акумулятор",
    "Пристрій не заряджається",
    "Не працює сенсор",
    "Проблеми зі звуком",
    "Пристрій не вмикається",
    "Потрібна діагностика",
];

const repairStatuses: RepairStatus[] = [
    "received",
    "diagnosing",
    "in_repair",
    "ready",
    "issued",
    "issued",
    "issued",
    "cancelled",
];

const shopStatuses: ShopOrderStatus[] = [
    "new",
    "paid",
    "shipped",
    "shipped",
    "cancelled",
];

async function main() {
    const now = new Date();

    const periodStart = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() - 5,
            1,
        ),
    );

    function randomDate(monthOffset: number): Date {
        const start = Date.UTC(
            periodStart.getUTCFullYear(),
            periodStart.getUTCMonth() + monthOffset,
            1,
        );

        const nextMonth = Date.UTC(
            periodStart.getUTCFullYear(),
            periodStart.getUTCMonth() + monthOffset + 1,
            1,
        );

        const end = Math.min(
            nextMonth - 1,
            now.getTime(),
        );

        return new Date(
            start + Math.floor(random() * (end - start + 1)),
        );
    }

    const result = await prisma.$transaction(
        async (tx) => {
            await tx.$queryRaw`
                SELECT 1::int AS locked
                FROM pg_advisory_xact_lock(20261126)
            `;

            const existing = await tx.customer.findUnique({
                where: { phone: DEMO_PHONE },
            });

            if (existing) {
                console.log("Demo data already loaded, skipped");
                return null;
            }

            const models = await tx.deviceModel.findMany({
                orderBy: { id: "asc" },
            });

            const technicians = await tx.technician.findMany({
                where: { isActive: true },
                orderBy: { id: "asc" },
            });

            const parts = await tx.part.findMany({
                where: { deletedAt: null },
                include: {
                    compatibleModels: true,
                },
                orderBy: { sku: "asc" },
            });

            if (
                models.length === 0 ||
                technicians.length === 0 ||
                parts.length === 0
            ) {
                throw new Error(
                    "Reference data is missing. Run npm run db:seed first.",
                );
            }

            // Створення 30 клієнтів

            const customers = await tx.customer.createManyAndReturn({
                data: Array.from({ length: 30 }, (_, i) => ({
                    fullName: `${firstNames[i % 10]} ${lastNames[Math.floor(i / 10)]}`,

                    phone: `+38099${String(i + 1).padStart(7, "0")}`,

                    email: `demo${i + 1}@example.com`,

                    createdAt: new Date(
                        periodStart.getTime() - DAY,
                    ),
                })),
            });

            customers.sort((a, b) =>
                a.phone.localeCompare(b.phone),
            );

            // Моделі, для яких є сумісні запчастини

            const compatibleModels = models.filter((model) =>
                parts.some((part) =>
                    part.compatibleModels.some(
                        (entry) => entry.modelId === model.id,
                    ),
                ),
            );

            // Створення 40 пристроїв

            const devices = await tx.device.createManyAndReturn({
                data: Array.from({ length: 40 }, (_, i) => {
                    const customer =
                        i < customers.length
                            ? customers[i]
                            : pick(customers);

                    const model =
                        i % 4 !== 0 && compatibleModels.length > 0
                            ? pick(compatibleModels)
                            : pick(models);

                    return {
                        customerId: customer.id,
                        modelId: model.id,
                        serialNumber: `DEMO-${String(i + 1).padStart(5, "0")}`,
                    };
                }),
            });

            devices.sort((a, b) =>
                a.serialNumber.localeCompare(b.serialNumber),
            );

            // Створення 90 ремонтів

            const repairParts: Prisma.RepairOrderPartCreateManyInput[] =
                [];

            for (let i = 0; i < 90; i++) {
                const device =
                    i < devices.length
                        ? devices[i]
                        : pick(devices);

                const status =
                    repairStatuses[i % repairStatuses.length];

                const createdAt = randomDate(i % 6);

                const isCompleted =
                    status === "ready" || status === "issued";

                const completedAt = isCompleted
                    ? new Date(
                          Math.min(
                              createdAt.getTime() +
                                  randomInt(1, 14) * DAY,
                              now.getTime(),
                          ),
                      )
                    : null;

                const repair = await tx.repairOrder.create({
                    data: {
                        deviceId: device.id,

                        technicianId:
                            status === "received"
                                ? null
                                : pick(technicians).id,

                        status,

                        problemDescription: pick(problems),

                        laborCost:
                            status === "received" ||
                            status === "cancelled"
                                ? 0
                                : randomInt(20, 150),

                        createdAt,
                        completedAt,
                    },
                });

                // Використовуємо лише сумісні запчастини

                const availableParts = parts.filter((part) =>
                    part.compatibleModels.some(
                        (entry) => entry.modelId === device.modelId,
                    ),
                );

                if (
                    availableParts.length > 0 &&
                    (
                        status === "in_repair" ||
                        status === "ready" ||
                        status === "issued"
                    )
                ) {
                    const candidates = [...availableParts];

                    const count = randomInt(
                        1,
                        Math.min(2, candidates.length),
                    );

                    for (let j = 0; j < count; j++) {
                        const index = randomInt(
                            0,
                            candidates.length - 1,
                        );

                        const [part] = candidates.splice(index, 1);

                        repairParts.push({
                            orderId: repair.id,
                            partId: part.id,
                            quantity: 1,
                            unitPrice: part.price,
                        });
                    }
                }
            }

            if (repairParts.length > 0) {
                await tx.repairOrderPart.createMany({
                    data: repairParts,
                });
            }

            // Створення 70 замовлень магазину

            const shopItems: Prisma.ShopOrderItemCreateManyInput[] =
                [];

            for (let i = 0; i < 70; i++) {
                const order = await tx.shopOrder.create({
                    data: {
                        customerId: pick(customers).id,

                        status:
                            shopStatuses[i % shopStatuses.length],

                        createdAt: randomDate(i % 6),
                    },
                });

                const candidates = [...parts];

                const count = randomInt(
                    1,
                    Math.min(3, candidates.length),
                );

                for (let j = 0; j < count; j++) {
                    const index = randomInt(
                        0,
                        candidates.length - 1,
                    );

                    const [part] = candidates.splice(index, 1);

                    shopItems.push({
                        orderId: order.id,
                        partId: part.id,
                        quantity: randomInt(1, 3),
                        unitPrice: part.price,
                    });
                }
            }

            await tx.shopOrderItem.createMany({
                data: shopItems,
            });

            // Історія ремонтів і замовлень належить минулому.
            // Залишки запчастин — поточний знімок складу.
            // Тому історичні операції не списують склад.

            const stockValues = parts.map((part) =>
                Prisma.sql`(
                    ${part.id}::int,
                    ${randomInt(10, 50)}::int
                )`,
            );

            await tx.$executeRaw`
                UPDATE parts AS p
                SET stock_qty = v.qty,
                    version = p.version + 1
                FROM (
                    VALUES ${Prisma.join(stockValues)}
                ) AS v(id, qty)
                WHERE p.id = v.id
            `;

            return {
                customers: customers.length,
                devices: devices.length,
                repairs: 90,
                repairParts: repairParts.length,
                shopOrders: 70,
                shopItems: shopItems.length,
                updatedParts: parts.length,
            };
        },
        {
            timeout: 120000,
        },
    );

    if (result) {
        console.log("Demo data loaded successfully");
        console.table(result);
    }
}

main()
    .catch((error) => {
        console.error("Demo data loading failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());