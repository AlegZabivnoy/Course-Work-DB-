import { prisma } from "../db/prisma";
import * as repairRepository from "../repositories/repair.repository";
import { ConflictError, NotFoundError } from "../errors";

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