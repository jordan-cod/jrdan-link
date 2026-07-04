import { zValidator } from '@hono/zod-validator';
import type { Hono } from 'hono';

import { purgeEdgeCache } from '../shared/cache';
import type { AdminEnv } from '../shared/env';
import { type LinkMetadata, shortUrl } from '../shared/link';
import { createLinkSchema, updateLinkSchema } from '../shared/schemas';
import { newShortId } from '../shared/short-id';

const ID_LENGTH = 5;
const MAX_ID_ATTEMPTS = 5;

async function generateUniqueId(kv: KVNamespace): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = newShortId(ID_LENGTH);
    if ((await kv.get(id)) === null) return id;
  }
  return null;
}

export function registerLinkRoutes(app: Hono<{ Bindings: AdminEnv }>): void {
  app.post('/links', zValidator('json', createLinkSchema), async (c) => {
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

    return c.json({ id, url, short_url: shortUrl(c.env.BASE_URL, id) }, 201);
  });

  app.get('/links', async (c) => {
    const list = await c.env.LINKS.list<LinkMetadata>();
    const links = list.keys.map((key) => ({
      id: key.name,
      url: key.metadata?.url ?? null,
      short_url: shortUrl(c.env.BASE_URL, key.name),
      created_at: key.metadata?.createdAt ?? null,
      expires_at: key.expiration ? new Date(key.expiration * 1000).toISOString() : null,
    }));
    return c.json({ links });
  });

  app.get('/links/:id', async (c) => {
    const id = c.req.param('id');
    const url = await c.env.LINKS.get(id, 'text');
    if (url === null) return c.json({ error: 'link not found' }, 404);
    return c.json({ id, url, short_url: shortUrl(c.env.BASE_URL, id) });
  });

  app.patch('/links/:id', zValidator('json', updateLinkSchema), async (c) => {
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

    return c.json({ id, url, short_url: shortUrl(c.env.BASE_URL, id) });
  });

  app.delete('/links/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.LINKS.delete(id);
    await c.env.DB.prepare('DELETE FROM clicks WHERE link_id = ?').bind(id).run();
    await purgeEdgeCache(c.env, id);
    return c.body(null, 204);
  });
}
