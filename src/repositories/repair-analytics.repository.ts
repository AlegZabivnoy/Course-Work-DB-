import { prisma } from "../db/prisma";

export function getModelReliability(minRepairs: number) {
    return prisma.$queryRaw`
        WITH model_stats AS (
            SELECT b.id   AS brand_id,
                   b.name AS brand,
                   m.id   AS model_id,
                   m.name AS model,
                   COUNT(*)::int AS repairs_count,
                   ROUND(AVG(EXTRACT(EPOCH FROM (r.completed_at - r.created_at)) / 86400)::numeric, 1)::float AS avg_repair_days,
                   ROUND(AVG(r.labor_cost), 2)::float AS avg_labor_cost
            FROM repair_orders r
            JOIN devices d       ON d.id = r.device_id
            JOIN device_models m ON m.id = d.model_id
            JOIN brands b        ON b.id = m.brand_id
            WHERE r.status <> 'cancelled'
            GROUP BY b.id, b.name, m.id, m.name
            HAVING COUNT(*) >= ${minRepairs}
        )
        SELECT brand,
               model,
               repairs_count AS "repairsCount",
               avg_repair_days AS "avgRepairDays",
               avg_labor_cost AS "avgLaborCost",
               RANK() OVER (PARTITION BY brand_id ORDER BY repairs_count DESC)::int AS "rankInBrand"
        FROM model_stats
        ORDER BY repairs_count DESC, model`;
}