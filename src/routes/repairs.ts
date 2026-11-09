import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { acceptRepair, addPartToRepair } from "../services/repair.service";

const phoneSchema = z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{10,15}$/, "Phone must contain 10–15 digits"));

const acceptRepairSchema = z.object({
    customer: z.object({
        fullName: z.string().trim().min(2).max(150),
        phone: phoneSchema,
        email: z.email().max(255).optional(),
    }),
    device: z.object({
        modelId: z.number().int().positive(),
        serialNumber: z.string().trim().toUpperCase().min(5).max(50),
    }),
    problemDescription: z.string().trim().min(5).max(2000),
});

const repairIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const addPartSchema = z.object({
    partId: z.number().int().positive(),
    quantity: z.number().int().positive().max(10),
});

export async function repairRoutes(app: FastifyInstance) {
    app.post("/repairs", async (request, reply) => {
        const parsed = acceptRepairSchema.parse(request.body);
        const repair = await acceptRepair(parsed);
        return reply.code(201).send(repair);
    });

    app.post("/repairs/:id/parts", async (request) => {
        const { id } = repairIdSchema.parse(request.params);
        const body = addPartSchema.parse(request.body);
        return addPartToRepair(id, body);
    });
}
