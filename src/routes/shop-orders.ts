import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createShopOrder } from "../services/shop.service";

const schema = z.object({
  customerId: z.number().int().positive(),
  items: z.array(z.object({ partId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
});

export async function shopOrderRoutes(app: FastifyInstance) {
  app.post("/shop-orders", async (request, reply) => {
    const order = await createShopOrder(schema.parse(request.body));
    return reply.code(201).send(order);
  });
}
