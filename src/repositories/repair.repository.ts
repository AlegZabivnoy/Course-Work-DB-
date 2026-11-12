import type { Prisma, RepairStatus } from "../../generated/prisma/client";

type Db = Prisma.TransactionClient;

export const repairOrderInclude = {
    device: {
        include: {
            model: { include: { brand: true } },
            customer: true,
        },
    },
    technician: true,
    parts: { include: { part: true } },
} satisfies Prisma.RepairOrderInclude;

export function findDeviceModelById(db: Db, id: number) {
    return db.deviceModel.findUnique({ where: { id } });
}

export function findCustomerByPhone(db: Db, phone: string) {
    return db.customer.findUnique({ where: { phone } });
}

export function createCustomer(
    db: Db,
    data: { fullName: string; phone: string; email?: string },
) {
    return db.customer.create({ data });
}

export function findDeviceBySerial(db: Db, serialNumber: string) {
    return db.device.findUnique({ where: { serialNumber } });
}

export function createDevice(
    db: Db,
    data: { customerId: number; modelId: number; serialNumber: string },
) {
    return db.device.create({ data });
}

export function createRepairOrder(
    db: Db,
    data: { deviceId: number; problemDescription: string },
) {
    return db.repairOrder.create({ data, include: repairOrderInclude });
}

export async function lockRepairOrder(db: Db, id: number) {
    const rows = await db.$queryRaw<{ id: number; status: string; device_id: number }[]>`
        SELECT id, status::text AS status, device_id
        FROM repair_orders
        WHERE id = ${id}
        FOR UPDATE`;
    return rows[0] ?? null;
}

export async function lockPart(db: Db, id: number) {
    const rows = await db.$queryRaw<
        { id: number; stock_qty: number; price: Prisma.Decimal; deleted_at: Date | null }[]
    >`
        SELECT id, stock_qty, price, deleted_at
        FROM parts
        WHERE id = ${id}
        FOR UPDATE`;
    return rows[0] ?? null;
}

export async function isPartCompatibleWithDevice(db: Db, partId: number, deviceId: number) {
    const device = await db.device.findUniqueOrThrow({
        where: { id: deviceId },
        select: { modelId: true },
    });
    const link = await db.partCompatibility.findUnique({
        where: { partId_modelId: { partId, modelId: device.modelId } },
    });
    return link !== null;
}

export function decrementPartStock(db: Db, partId: number, quantity: number) {
    return db.part.update({
        where: { id: partId },
        data: {
            stockQty: { decrement: quantity },
            version: { increment: 1 },
        },
    });
}

export function addPartToRepairOrder(
    db: Db,
    data: { orderId: number; partId: number; quantity: number; unitPrice: Prisma.Decimal },
) {
    return db.repairOrderPart.upsert({
        where: { orderId_partId: { orderId: data.orderId, partId: data.partId } },
        update: { quantity: { increment: data.quantity } },
        create: data,
    });
}

export function findRepairOrderById(db: Db, id: number) {
    return db.repairOrder.findUnique({ where: { id }, include: repairOrderInclude });
}

export function findRepairOrderState(db: Db, id: number) {
    return db.repairOrder.findUnique({
        where: { id },
        select: { id: true, status: true, version: true, technicianId: true },
    });
}

export function findActiveTechnician(db: Db, id: number) {
    return db.technician.findFirst({ where: { id, isActive: true } });
}

export function updateRepairOrderStatus(
    db: Db,
    id: number,
    expected: { version: number; status: RepairStatus },
    data: Prisma.RepairOrderUncheckedUpdateManyInput,
) {
    return db.repairOrder.updateMany({
        where: { id, version: expected.version, status: expected.status },
        data: { ...data, version: { increment: 1 } },
    });
}

export function findRepairOrderParts(db: Db, orderId: number) {
    return db.repairOrderPart.findMany({ where: { orderId } });
}

export function returnPartToStock(db: Db, partId: number, quantity: number) {
    return db.part.update({
        where: { id: partId },
        data: {
            stockQty: { increment: quantity },
            version: { increment: 1 },
        },
    });
}