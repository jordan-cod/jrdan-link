import type { LinkRow } from '@/db';

const CACHE_MAX = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  link: LinkRow;
  expiresAt: number;
}

// Cache LRU em memória no read path: hot links respondem da RAM
// sem tocar no Postgres.
const cache = new Map<string, CacheEntry>();

export const linkCache = {
  get(id: string): LinkRow | undefined {
    const entry = cache.get(id);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      cache.delete(id);
      return undefined;
    }
    cache.delete(id);
    cache.set(id, entry);
    return entry.link;
  },

  set(id: string, link: LinkRow) {
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(id, { link, expiresAt: Date.now() + CACHE_TTL_MS });
  },

  invalidate(id: string) {
    cache.delete(id);
  },
};
