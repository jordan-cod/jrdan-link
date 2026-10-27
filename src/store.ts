/**
 * D1 é a fonte da verdade; o KV é cache do caminho quente.
 *
 * Toda escrita passa pelo D1 e acerta o KV junto — é o que impede o cache de
 * servir um destino que já mudou. O redirect lê do KV e, no miss, volta ao D1 e
 * repõe, então o KV pode ser perdido inteiro sem perder dado.
 */

import type { Link } from './link';

export interface Store {
  db: D1Database;
  cache: KVNamespace;
}

interface Row {
  slug: string;
  url: string;
  created_at: string;
  expires_at: string | null;
}

const COLUMNS = 'slug, url, created_at, expires_at';

function toLink(row: Row): Link {
  return {
    slug: row.slug,
    url: row.url,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

/** O KV expira a entrada junto com o link, então o cache nunca serve link morto. */
function cacheOptions(expiresAt: Date | null, now: Date) {
  if (!expiresAt) return undefined;
  const seconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  // O KV recusa TTL abaixo de 60s; nesse caso não vale cachear.
  return seconds >= 60 ? { expirationTtl: seconds } : undefined;
}

/** Caminho quente do redirect: KV, caindo pro D1 no miss. */
export async function resolve(store: Store, slug: string, now: Date): Promise<string | null> {
  const cached = await store.cache.get(slug, 'text');
  if (cached) return cached;

  const row = await store.db.prepare(`SELECT ${COLUMNS} FROM links WHERE slug = ?`).bind(slug).first<Row>();
  if (!row) return null;

  const link = toLink(row);
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return null;

  await store.cache.put(slug, link.url, cacheOptions(link.expiresAt, now));
  return link.url;
}

/** null quando o slug já está em uso. */
export async function create(store: Store, link: Link): Promise<Link | null> {
  const inserted = await store.db
    .prepare('INSERT INTO links (slug, url, created_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(link.slug, link.url, link.createdAt.toISOString(), link.expiresAt?.toISOString() ?? null)
    .run();

  if (inserted.meta.changes === 0) return null;

  await store.cache.put(link.slug, link.url, cacheOptions(link.expiresAt, link.createdAt));
  return link;
}

export async function get(store: Store, slug: string): Promise<Link | null> {
  const row = await store.db.prepare(`SELECT ${COLUMNS} FROM links WHERE slug = ?`).bind(slug).first<Row>();

  return row ? toLink(row) : null;
}

export async function list(store: Store): Promise<Link[]> {
  const { results } = await store.db.prepare(`SELECT ${COLUMNS} FROM links ORDER BY created_at DESC`).all<Row>();

  return results.map(toLink);
}

export async function updateUrl(store: Store, slug: string, url: string, now: Date): Promise<Link | null> {
  const row = await store.db
    .prepare(`UPDATE links SET url = ? WHERE slug = ? RETURNING ${COLUMNS}`)
    .bind(url, slug)
    .first<Row>();
  if (!row) return null;

  const link = toLink(row);
  // O cache é reescrito na hora: sem TTL de borda pra esperar, a edição vale já.
  await store.cache.put(slug, link.url, cacheOptions(link.expiresAt, now));
  return link;
}

export async function remove(store: Store, slug: string): Promise<boolean> {
  const deleted = await store.db.prepare('DELETE FROM links WHERE slug = ?').bind(slug).run();
  if (deleted.meta.changes === 0) return false;

  await store.cache.delete(slug);
  return true;
}

/** Sorteia até cair num slug livre; colisão é improvável, mas possível. */
export async function allocateSlug(store: Store, generate: () => string, attempts = 5): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const slug = generate();
    const taken = await store.db.prepare('SELECT 1 FROM links WHERE slug = ?').bind(slug).first();
    if (!taken) return slug;
  }
  return null;
}
