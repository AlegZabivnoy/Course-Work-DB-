import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { deleteCustomer } from "../services/shop.service";

export async function customerRoutes(app: FastifyInstance) {
  app.delete("/customers/:id", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    await deleteCustomer(id);
    return reply.code(204).send();
  });
}
