import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { acceptRepair, addPartToRepair, changeRepairStatus, deleteCancelledRepair, } from "../services/repair.service";

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

const changeStatusSchema = z.object({
    status: z.enum(["received", "diagnosing", "in_repair", "ready", "issued", "cancelled"]),
    version: z.number().int().nonnegative(),
    technicianId: z.number().int().positive().optional(),
    laborCost: z.number().nonnegative().max(100000).optional(),
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

    app.patch("/repairs/:id/status", async (request) => {
        const { id } = repairIdSchema.parse(request.params);
        const body = changeStatusSchema.parse(request.body);
        return changeRepairStatus(id, body);
    });

    app.delete("/repairs/:id", async (request, reply) => {
        const { id } = repairIdSchema.parse(request.params);
        await deleteCancelledRepair(id);
        return reply.code(204).send();
    });
}
