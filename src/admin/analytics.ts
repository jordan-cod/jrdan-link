import type { Context, Hono } from 'hono';

import type { AdminEnv } from '../shared/env';

function dateRange(c: Context): { clause: string; args: string[] } {
  const from = c.req.query('from');
  const to = c.req.query('to');
  const clause = `${from ? ' AND ts >= ?' : ''}${to ? ' AND ts <= ?' : ''}`;
  const args = [...(from ? [from] : []), ...(to ? [to] : [])];
  return { clause, args };
}

export function registerAnalyticsRoutes(app: Hono<{ Bindings: AdminEnv }>): void {
  app.get('/links/:id/stats', async (c) => {
    const id = c.req.param('id');
    const { clause, args } = dateRange(c);
    const where = `link_id = ?${clause}`;
    const params = [id, ...args];

    const results = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT count(*) AS clicks, coalesce(sum(is_bot), 0) AS bots FROM clicks WHERE ${where}`).bind(
        ...params,
      ),
      c.env.DB.prepare(
        `SELECT coalesce(country, '??') AS country, count(*) AS clicks FROM clicks WHERE ${where} AND is_bot = 0 GROUP BY country ORDER BY clicks DESC LIMIT 20`,
      ).bind(...params),
      c.env.DB.prepare(
        `SELECT date(ts) AS day, count(*) AS clicks FROM clicks WHERE ${where} AND is_bot = 0 GROUP BY day ORDER BY day DESC LIMIT 90`,
      ).bind(...params),
    ]);

    const totals = results[0]?.results[0] as { clicks: number; bots: number } | undefined;
    const total = totals?.clicks ?? 0;
    const bots = totals?.bots ?? 0;

    return c.json({
      total,
      bots,
      humans: total - bots,
      by_country: results[1]?.results ?? [],
      by_day: results[2]?.results ?? [],
    });
  });

  app.get('/links/:id/clicks', async (c) => {
    const id = c.req.param('id');
    const { clause, args } = dateRange(c);
    const rows = await c.env.DB.prepare(
      `SELECT ts, country, city, region, referer, is_bot FROM clicks WHERE link_id = ?${clause} ORDER BY ts DESC LIMIT 100`,
    )
      .bind(id, ...args)
      .all();
    return c.json({ clicks: rows.results });
  });
}
