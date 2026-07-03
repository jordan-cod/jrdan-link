import { sql, type LinkRow } from '@/db';

const SLUG_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const ID_LENGTH = 8;
const CACHE_MAX = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';

export class NotFoundError extends Error {}
export class InvalidUrlError extends Error {}
export class InvalidSlugError extends Error {}
export class SlugTakenError extends Error {}

interface CacheEntry {
  link: LinkRow;
  expiresAt: number;
}

// Cache LRU em memória no read path: hot links respondem da RAM
// sem tocar no Postgres.
const cache = new Map<string, CacheEntry>();

function cacheGet(id: string): LinkRow | undefined {
  const entry = cache.get(id);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(id);
    return undefined;
  }
  cache.delete(id);
  cache.set(id, entry);
  return entry.link;
}

function cacheSet(id: string, link: LinkRow) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(id, { link, expiresAt: Date.now() + CACHE_TTL_MS });
}

function newShortId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

function validateUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidUrlError();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InvalidUrlError();
  if (!url.hostname) throw new InvalidUrlError();
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === UNIQUE_VIOLATION;
}

export async function resolve(id: string): Promise<LinkRow> {
  let link = cacheGet(id);
  if (!link) {
    const rows = await sql<LinkRow[]>`SELECT * FROM links WHERE id = ${id} AND active = true`;
    if (rows.length === 0) throw new NotFoundError();
    link = rows[0]!;
    cacheSet(id, link);
  }

  if (link.expires_at && link.expires_at < new Date()) throw new NotFoundError();
  return link;
}

export async function create(url: string, slug?: string, expiresAt?: Date): Promise<LinkRow> {
  validateUrl(url);

  if (slug) {
    if (!SLUG_PATTERN.test(slug)) throw new InvalidSlugError();
    try {
      const rows = await sql<LinkRow[]>`
        INSERT INTO links (id, url, expires_at)
        VALUES (${slug}, ${url}, ${expiresAt ?? null})
        RETURNING *`;
      return rows[0]!;
    } catch (err) {
      if (isUniqueViolation(err)) throw new SlugTakenError();
      throw err;
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = await sql<LinkRow[]>`
        INSERT INTO links (id, url, expires_at)
        VALUES (${newShortId()}, ${url}, ${expiresAt ?? null})
        RETURNING *`;
      return rows[0]!;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('could not generate unique short id');
}

export interface UpdateParams {
  url?: string;
  expiresAt?: Date;
  active?: boolean;
}

export async function update(id: string, params: UpdateParams): Promise<LinkRow> {
  if (params.url !== undefined) validateUrl(params.url);

  const rows = await sql<LinkRow[]>`
    UPDATE links SET
      url        = coalesce(${params.url ?? null}, url),
      expires_at = coalesce(${params.expiresAt ?? null}, expires_at),
      active     = coalesce(${params.active ?? null}, active)
    WHERE id = ${id}
    RETURNING *`;
  if (rows.length === 0) throw new NotFoundError();

  cache.delete(id);
  return rows[0]!;
}

export async function deactivate(id: string): Promise<void> {
  await sql`UPDATE links SET active = false WHERE id = ${id}`;
  cache.delete(id);
}

export type LinkWithClicks = LinkRow & { total_clicks: string };

export async function list(limit: number, offset: number): Promise<LinkWithClicks[]> {
  return sql<LinkWithClicks[]>`
    SELECT l.*,
           (SELECT count(*) FROM clicks c WHERE c.link_id = l.id AND NOT c.is_bot) AS total_clicks
    FROM links l
    ORDER BY l.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`;
}

export interface LinkStats {
  total_clicks: number;
  clicks_24h: number;
  clicks_7d: number;
  daily: { day: string; clicks: number }[];
  top_referrers: { name: string; clicks: number }[];
  devices: { name: string; clicks: number }[];
}

export async function stats(id: string): Promise<LinkStats> {
  const [totals, daily, referrers, devices] = await Promise.all([
    sql`
      SELECT
        count(*)::int AS total_clicks,
        (count(*) FILTER (WHERE ts > now() - interval '24 hours'))::int AS clicks_24h,
        (count(*) FILTER (WHERE ts > now() - interval '7 days'))::int AS clicks_7d
      FROM clicks
      WHERE link_id = ${id} AND NOT is_bot`,
    sql`
      SELECT date_trunc('day', ts)::date::text AS day, count(*)::int AS clicks
      FROM clicks
      WHERE link_id = ${id} AND NOT is_bot AND ts > now() - interval '30 days'
      GROUP BY day ORDER BY day DESC`,
    sql`
      SELECT coalesce(referrer, '(direct)') AS name, count(*)::int AS clicks
      FROM clicks
      WHERE link_id = ${id} AND NOT is_bot
      GROUP BY name ORDER BY clicks DESC LIMIT 10`,
    sql`
      SELECT coalesce(device, 'unknown') AS name, count(*)::int AS clicks
      FROM clicks
      WHERE link_id = ${id} AND NOT is_bot
      GROUP BY name ORDER BY clicks DESC`,
  ]);

  const t = totals[0] as { total_clicks: number; clicks_24h: number; clicks_7d: number };
  return {
    total_clicks: t.total_clicks,
    clicks_24h: t.clicks_24h,
    clicks_7d: t.clicks_7d,
    daily: daily as unknown as LinkStats['daily'],
    top_referrers: referrers as unknown as LinkStats['top_referrers'],
    devices: devices as unknown as LinkStats['devices'],
  };
}
