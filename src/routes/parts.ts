import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listParts, patchPart, searchParts } from "../services/shop.service";

const partIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const patchPartSchema = z
    .object({
        version: z.number().int().nonnegative(),
        price: z.number().positive().optional(),
        stockQty: z.number().int().nonnegative().optional(),
    })
    .refine((value) => value.price !== undefined || value.stockQty !== undefined);

const searchPartsSchema = z.object({
    q: z.string().trim().min(1),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const listPartsSchema = z.object({
    modelId: z.coerce.number().int().positive().optional(),
    type: z
        .enum(["screen", "battery", "camera", "back_cover", "charging_port", "speaker", "other"])
        .optional(),
    sort: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function partRoutes(app: FastifyInstance) {
    app.patch("/parts/:id", async (request) => {
        const { id } = partIdSchema.parse(request.params);
        const body = patchPartSchema.parse(request.body);
        return patchPart(id, body);
    });

    app.get("/parts/search", async (request) => {
        const query = searchPartsSchema.parse(request.query);
        return searchParts(query);
    });

    app.get("/parts", async (request) => {
        const query = listPartsSchema.parse(request.query);
        return listParts(query);
    });
}
