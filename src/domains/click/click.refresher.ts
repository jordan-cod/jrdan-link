import { sql } from '@/db';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Mantém a materialized view clicks_daily atualizada sem bloquear
// leituras do Grafana (REFRESH CONCURRENTLY).
export function startRefresher(): Timer {
  return setInterval(async () => {
    try {
      await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY clicks_daily`;
    } catch (err) {
      console.error('refresh clicks_daily failed', err);
    }
  }, REFRESH_INTERVAL_MS);
}
