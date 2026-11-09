import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db/prisma";
import { ConflictError, NotFoundError } from "../errors";
import * as repo from "../repositories/shop.repository";

export async function createShopOrder(input: {
    customerId: number;
    items: { partId: number; quantity: number }[];
}) {
    return prisma.$transaction(async (tx) => {
        const customer = await repo.findActiveCustomer(tx, input.customerId);
        if (!customer) {
            throw new NotFoundError("Active customer not found");
        }

        const quantities = new Map<number, number>();
        for (const item of input.items) {
            const currentQuantity = quantities.get(item.partId) ?? 0;
            quantities.set(item.partId, currentQuantity + item.quantity);
        }

        const pricedItems: {
            partId: number;
            quantity: number;
            unitPrice: Prisma.Decimal;
        }[] = [];

        for (const [partId, quantity] of quantities) {
            const part = await repo.findActivePart(tx, partId);
            if (!part) {
                throw new NotFoundError(`Part ${partId} not found`);
            }
            if (part.stockQty < quantity) {
                throw new ConflictError(`Insufficient stock for part ${partId}`);
            }

            pricedItems.push({
                partId,
                quantity,
                unitPrice: part.price,
            });
        }

        const order = await repo.createShopOrder(tx, input.customerId);
        await repo.createShopOrderItems(tx, order.id, pricedItems);

        for (const item of pricedItems) {
            const result = await repo.decrementStock(tx, item.partId, item.quantity);
            if (result.count !== 1) {
                throw new ConflictError(`Insufficient stock for part ${item.partId}`);
            }
        }

        return repo.findShopOrder(tx, order.id);
    });
}

export async function patchPart(
    id: number,
    input: { version: number; price?: number; stockQty?: number },
) {
    return prisma.$transaction(async (tx) => {
        const updated = await repo.updatePartVersion(tx, id, input.version, {
            ...(input.price !== undefined
                ? { price: new Prisma.Decimal(input.price) }
                : {}),
            ...(input.stockQty !== undefined
                ? { stockQty: input.stockQty }
                : {}),
        });

        if (!updated.count) {
            const part = await repo.findPartById(tx, id);
            if (!part) {
                throw new NotFoundError("Part not found");
            }
            throw new ConflictError(
                "Part was changed; reload it and retry with the current version",
            );
        }

        return repo.findPartById(tx, id);
    });
}

export async function deleteCustomer(id: number) {
    const result = await repo.softDeleteCustomer(prisma, id);
    if (!result.count) {
        throw new NotFoundError("Active customer not found");
    }
    return { id, deleted: true };
}

export async function listParts(input: {
    modelId?: number;
    type?: string;
    sort: "asc" | "desc";
    page: number;
    pageSize: number;
}) {
    return repo.listParts(prisma, {
        ...input,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
    });
}

export async function searchParts(input: {
    q: string;
    page: number;
    pageSize: number;
}) {
    return repo.searchParts(
        prisma,
        input.q,
        (input.page - 1) * input.pageSize,
        input.pageSize,
    );
}
