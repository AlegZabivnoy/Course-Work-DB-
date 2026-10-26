import type { Prisma } from "../../generated/prisma/client";

type Db = Prisma.TransactionClient;

export const repairOrderInclude = {
    device: {
        include: {
            model: { include: { brand: true } },
            customer: true,
        },
    },
    technician: true,
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