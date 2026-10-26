import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { acceptRepair } from "../services/repair.service";
import { AppError } from "../errors";

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

export async function repairRoutes(app: FastifyInstance) {
    app.post("/repairs", async (request, reply) => {
        const parsed = acceptRepairSchema.safeParse(request.body);

        if (!parsed.success) {
            return reply.code(400).send({
                error: "ValidationError",
                details: parsed.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        try {
            const repair = await acceptRepair(parsed.data);
            return reply.code(201).send(repair);
        } catch (error) {
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({
                    error: error.name,
                    message: error.message,
                });
            }
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                return reply.code(409).send({
                    error: "Conflict",
                    message: "Record with the same unique value already exists",
                });
            }
            throw error;
        }
    });
}