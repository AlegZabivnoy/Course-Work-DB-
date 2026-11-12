import { prisma } from "../db/prisma";
import * as repairRepository from "../repositories/repair.repository";
import { ConflictError, NotFoundError } from "../errors";
import type { Prisma, RepairStatus } from "../../generated/prisma/client";

export interface AcceptRepairInput {
    customer: { fullName: string; phone: string; email?: string };
    device: { modelId: number; serialNumber: string };
    problemDescription: string;
}

export async function acceptRepair(input: AcceptRepairInput) {
    return prisma.$transaction(async (tx) => {
        const model = await repairRepository.findDeviceModelById(tx, input.device.modelId);
        if (!model) {
            throw new NotFoundError(`Device model with id ${input.device.modelId} not found`);
        }

        let customer = await repairRepository.findCustomerByPhone(tx, input.customer.phone);
        if (customer?.deletedAt) {
            throw new ConflictError("Customer account is deactivated");
        }
        if (!customer) {
            customer = await repairRepository.createCustomer(tx, input.customer);
        }

        let device = await repairRepository.findDeviceBySerial(tx, input.device.serialNumber);
        if (device) {
            if (device.customerId !== customer.id) {
                throw new ConflictError("Device with this serial number belongs to another customer");
            }
            if (device.modelId !== model.id) {
                throw new ConflictError("Device with this serial number is registered as a different model");
            }
        } else {
            device = await repairRepository.createDevice(tx, {
                customerId: customer.id,
                modelId: model.id,
                serialNumber: input.device.serialNumber,
            });
        }

        return repairRepository.createRepairOrder(tx, {
            deviceId: device.id,
            problemDescription: input.problemDescription,
        });
    });
}

const EDITABLE_STATUSES = ["received", "diagnosing", "in_repair"];

export async function addPartToRepair(
    repairId: number,
    input: { partId: number; quantity: number },
) {
    return prisma.$transaction(async (tx) => {
        const order = await repairRepository.lockRepairOrder(tx, repairId);
        if (!order) {
            throw new NotFoundError(`Repair order ${repairId} not found`);
        }
        if (!EDITABLE_STATUSES.includes(order.status)) {
            throw new ConflictError(`Cannot add parts to a repair with status "${order.status}"`);
        }

        const part = await repairRepository.lockPart(tx, input.partId);
        if (!part || part.deleted_at) {
            throw new NotFoundError(`Part ${input.partId} not found`);
        }

        const compatible = await repairRepository.isPartCompatibleWithDevice(
            tx,
            input.partId,
            order.device_id,
        );
        if (!compatible) {
            throw new ConflictError("Part is not compatible with this device model");
        }

        if (part.stock_qty < input.quantity) {
            throw new ConflictError(
                `Insufficient stock: requested ${input.quantity}, available ${part.stock_qty}`,
            );
        }

        await repairRepository.decrementPartStock(tx, input.partId, input.quantity);
        await repairRepository.addPartToRepairOrder(tx, {
            orderId: repairId,
            partId: input.partId,
            quantity: input.quantity,
            unitPrice: part.price,
        });

        return repairRepository.findRepairOrderById(tx, repairId);
    });
}

const ALLOWED_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
    received: ["diagnosing", "cancelled"],
    diagnosing: ["in_repair", "cancelled"],
    in_repair: ["ready", "cancelled"],
    ready: ["issued"],
    issued: [],
    cancelled: [],
};

export interface ChangeRepairStatusInput {
    status: RepairStatus;
    version: number;
    technicianId?: number;
    laborCost?: number;
}

export async function changeRepairStatus(repairId: number, input: ChangeRepairStatusInput) {
    return prisma.$transaction(async (tx) => {
        const order = await repairRepository.findRepairOrderState(tx, repairId);
        if (!order) {
            throw new NotFoundError(`Repair order ${repairId} not found`);
        }

        if (!ALLOWED_TRANSITIONS[order.status].includes(input.status)) {
            throw new ConflictError(
                `Cannot change status from "${order.status}" to "${input.status}"`,
            );
        }

        if (input.technicianId !== undefined) {
            const technician = await repairRepository.findActiveTechnician(tx, input.technicianId);
            if (!technician) {
                throw new NotFoundError(`Active technician ${input.technicianId} not found`);
            }
        }

        const technicianId = input.technicianId ?? order.technicianId;
        if (input.status === "diagnosing" && technicianId === null) {
            throw new ConflictError("Assign a technician before starting diagnosis");
        }

        const data: Prisma.RepairOrderUncheckedUpdateManyInput = { status: input.status };
        if (input.technicianId !== undefined) {
            data.technicianId = input.technicianId;
        }
        if (input.laborCost !== undefined) {
            data.laborCost = input.laborCost;
        }
        if (input.status === "ready") {
            data.completedAt = new Date();
        }

        const updated = await repairRepository.updateRepairOrderStatus(
            tx,
            repairId,
            { version: input.version, status: order.status },
            data,
        );
        if (updated.count === 0) {
            throw new ConflictError(
                "Repair order was changed by someone else; reload it and retry with the current version",
            );
        }

        if (input.status === "cancelled") {
            const parts = await repairRepository.findRepairOrderParts(tx, repairId);
            for (const item of parts) {
                await repairRepository.returnPartToStock(tx, item.partId, item.quantity);
            }
        }

        return repairRepository.findRepairOrderById(tx, repairId);
    });
}

export async function deleteCancelledRepair(repairId: number) {
    return prisma.$transaction(async (tx) => {
        const result = await repairRepository.deleteCancelledRepairOrder(tx, repairId);
        if (result.count === 1) {
            return;
        }

        const order = await repairRepository.findRepairOrderState(tx, repairId);
        if (!order) {
            throw new NotFoundError(`Repair order ${repairId} not found`);
        }
        throw new ConflictError(
            `Only cancelled repairs can be deleted; current status is "${order.status}"`,
        );
    });
}