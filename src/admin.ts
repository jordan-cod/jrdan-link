import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { type LinkMetadata, shortUrl } from './shared/link';
import { newShortId } from './shared/short-id';

interface Env {
  LINKS: KVNamespace;
  DB: D1Database;
  ADMIN_API_KEY: string;
  CF_ZONE_ID?: string;
  CF_API_TOKEN?: string;
}

async function purgeEdgeCache(env: Env, id: string): Promise<void> {
  if (!env.CF_ZONE_ID || !env.CF_API_TOKEN) return;
  await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: [shortUrl(id)] }),
  });
}

const ID_LENGTH = 5;
const MAX_ID_ATTEMPTS = 5;

async function generateUniqueId(kv: KVNamespace): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = newShortId(ID_LENGTH);
    if ((await kv.get(id)) === null) return id;
  }
  return null;
}

const httpUrl = z.string().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}, 'url must be a valid http(s) URL');

const createSchema = z.object({
  url: httpUrl,
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/)
    .optional(),
  expiresIn: z.number().int().positive().optional(),
});

const updateSchema = z.object({ url: httpUrl });

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const key = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || key !== c.env.ADMIN_API_KEY) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

app.post('/links', zValidator('json', createSchema), async (c) => {
  const { url, slug, expiresIn } = c.req.valid('json');

  let id: string;
  if (slug) {
    if ((await c.env.LINKS.get(slug)) !== null) {
      return c.json({ error: 'slug already taken' }, 409);
    }
    id = slug;
  } else {
    const generated = await generateUniqueId(c.env.LINKS);
    if (generated === null) {
      return c.json({ error: 'could not generate a unique id' }, 500);
    }
    id = generated;
  }

  const metadata: LinkMetadata = { url, createdAt: new Date().toISOString() };
  await c.env.LINKS.put(id, url, {
    metadata,
    ...(expiresIn ? { expirationTtl: expiresIn } : {}),
  });

  return c.json({ id, url, short_url: shortUrl(id) }, 201);
});

app.get('/links', async (c) => {
  const list = await c.env.LINKS.list<LinkMetadata>();
  const links = list.keys.map((key) => ({
    id: key.name,
    url: key.metadata?.url ?? null,
    short_url: shortUrl(key.name),
    created_at: key.metadata?.createdAt ?? null,
    expires_at: key.expiration ? new Date(key.expiration * 1000).toISOString() : null,
  }));
  return c.json({ links });
});

app.get('/links/:id', async (c) => {
  const id = c.req.param('id');
  const url = await c.env.LINKS.get(id, 'text');
  if (url === null) return c.json({ error: 'link not found' }, 404);
  return c.json({ id, url, short_url: shortUrl(id) });
});

app.patch('/links/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.LINKS.getWithMetadata<LinkMetadata>(id);
  if (existing.value === null) return c.json({ error: 'link not found' }, 404);

  const { url } = c.req.valid('json');
  const metadata: LinkMetadata = {
    url,
    createdAt: existing.metadata?.createdAt ?? new Date().toISOString(),
  };
  await c.env.LINKS.put(id, url, { metadata });
  await purgeEdgeCache(c.env, id);

  return c.json({ id, url, short_url: shortUrl(id) });
});

app.delete('/links/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.LINKS.delete(id);
  await c.env.DB.prepare('DELETE FROM clicks WHERE link_id = ?').bind(id).run();
  await purgeEdgeCache(c.env, id);
  return c.body(null, 204);
});

function dateRange(c: { req: { query: (k: string) => string | undefined } }) {
  const from = c.req.query('from');
  const to = c.req.query('to');
  const clause = `${from ? ' AND ts >= ?' : ''}${to ? ' AND ts <= ?' : ''}`;
  const args = [...(from ? [from] : []), ...(to ? [to] : [])];
  return { clause, args };
}

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

export default app;
