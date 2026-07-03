-- Visão pré-agregada pra dashboards (Grafana lê daqui em vez de varrer clicks).
-- Refresh feito pelo app a cada 5min com REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE MATERIALIZED VIEW clicks_daily AS
SELECT link_id,
       date_trunc('day', ts)::date AS day,
       count(*)                    AS clicks
FROM clicks
GROUP BY link_id, day;

-- Índice único é requisito do REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX clicks_daily_link_day_idx ON clicks_daily (link_id, day);
