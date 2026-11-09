import type { PartType, Prisma } from "../../generated/prisma/client";

type Db = Prisma.TransactionClient;

export const shopOrderInclude = {
  items: { include: { part: true } },
  customer: true,
} satisfies Prisma.ShopOrderInclude;

export function findActiveCustomer(db: Db, id: number) {
  return db.customer.findFirst({ where: { id, deletedAt: null } });
}

export function findActivePart(db: Db, id: number) {
  return db.part.findFirst({ where: { id, deletedAt: null } });
}

export function createShopOrder(db: Db, customerId: number) {
  return db.shopOrder.create({ data: { customerId } });
}

export function createShopOrderItems(db: Db, orderId: number, items: { partId: number; quantity: number; unitPrice: Prisma.Decimal }[]) {
  return db.shopOrderItem.createMany({ data: items.map((item) => ({ ...item, orderId })) });
}

export function decrementStock(db: Db, partId: number, quantity: number) {
  return db.part.updateMany({
    where: { id: partId, deletedAt: null, stockQty: { gte: quantity } },
    data: { stockQty: { decrement: quantity } },
  });
}

export function findShopOrder(db: Db, id: number) {
  return db.shopOrder.findUnique({ where: { id }, include: shopOrderInclude });
}

export function updatePartVersion(db: Db, id: number, version: number, data: { price?: Prisma.Decimal; stockQty?: number }) {
  return db.part.updateMany({
    where: { id, version, deletedAt: null },
    data: { ...data, version: { increment: 1 } },
  });
}

export function findPartById(db: Db, id: number) {
  return db.part.findFirst({ where: { id, deletedAt: null } });
}

export function softDeleteCustomer(db: Db, id: number) {
  return db.customer.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
}

export function listParts(db: Db, input: { modelId?: number; type?: string; sort: "asc" | "desc"; skip: number; take: number }) {
  return db.part.findMany({
    where: {
      deletedAt: null,
      ...(input.type ? { partType: input.type as PartType } : {}),
      ...(input.modelId ? { compatibleModels: { some: { modelId: input.modelId } } } : {}),
    },
    orderBy: { price: input.sort }, skip: input.skip, take: input.take,
    include: { compatibleModels: { include: { model: { include: { brand: true } } } } },
  });
}

export function searchParts(db: Db, term: string, skip: number, take: number) {
  return db.$queryRaw<Array<{id:number; sku:string; name:string; part_type:string; price: string; stock_qty:number}>>`
    SELECT id, sku, name, part_type::text, price::text, stock_qty
    FROM parts WHERE deleted_at IS NULL AND name ILIKE ${`%${term}%`}
    ORDER BY name LIMIT ${take} OFFSET ${skip}`;
}
