import { prisma } from "../db/prisma";

export function getTopPartsByCategory() {
    return prisma.$queryRaw`
        WITH revenue AS (
            SELECT p.part_type::text AS category, p.id AS part_id, p.name,
                   SUM(oi.quantity * oi.unit_price) AS total_revenue,
                   ROW_NUMBER() OVER (
                       PARTITION BY p.part_type
                       ORDER BY SUM(oi.quantity * oi.unit_price) DESC
                   )::int AS position
            FROM shop_order_items oi
            JOIN shop_orders o ON o.id = oi.order_id
            JOIN parts p ON p.id = oi.part_id
            WHERE o.status <> 'cancelled'
            GROUP BY p.part_type, p.id, p.name
        )
        SELECT category, part_id AS "partId", name,
               total_revenue AS "totalRevenue", position
        FROM revenue
        WHERE position <= 3
        ORDER BY category, position`;
}

export function getMonthlySales() {
    return prisma.$queryRaw`
        WITH monthly AS (
            SELECT date_trunc('month', o.created_at) AS month,
                   SUM(oi.quantity * oi.unit_price) AS revenue
            FROM shop_orders o
            JOIN shop_order_items oi ON oi.order_id = o.id
            WHERE o.status <> 'cancelled'
            GROUP BY date_trunc('month', o.created_at)
        )
        SELECT month, revenue,
               revenue - LAG(revenue) OVER (ORDER BY month) AS "changeFromPreviousMonth"
        FROM monthly
        ORDER BY month`;
}
