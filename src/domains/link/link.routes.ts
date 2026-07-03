import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import QRCode from 'qrcode';

import { config } from '@/config';
import type { LinkRow } from '@/db';
import { recordClick } from '@/domains/click/use-cases/record-click';
import { InvalidSlugError, InvalidUrlError, NotFoundError, SlugTakenError } from '@/domains/link/link.errors';
import { createLinkSchema, errorSchema, linkSchema, updateLinkSchema } from '@/domains/link/link.schema';
import { createLink } from '@/domains/link/use-cases/create-link';
import { deactivateLink } from '@/domains/link/use-cases/deactivate-link';
import { listLinks } from '@/domains/link/use-cases/list-links';
import { resolveLink } from '@/domains/link/use-cases/resolve-link';
import { updateLink } from '@/domains/link/use-cases/update-link';
import { apiKeyAuth } from '@/http/auth';

function toLinkBody(link: LinkRow) {
  return {
    id: link.id,
    url: link.url,
    short_url: `${config.BASE_URL}/${link.id}`,
    active: link.active,
    created_at: link.createdAt.toISOString(),
    expires_at: link.expiresAt?.toISOString() ?? null,
  };
}

const idParam = z.object({ id: z.string().openapi({ example: 'aB3xK9pQ' }) });

const redirectRoute = createRoute({
  method: 'get',
  path: '/{id}',
  summary: 'Redirect to destination',
  description: 'Redireciona pro destino registrado, repassando query params, e registra o click de forma assíncrona.',
  tags: ['Links'],
  request: { params: idParam },
  responses: {
    302: { description: 'Redirect pro destino' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Link não existe' },
  },
});

const createLinkRoute = createRoute({
  method: 'post',
  path: '/links',
  summary: 'Create short link',
  description: 'Encurta uma URL, com slug customizado opcional. Requer `X-API-Key`.',
  tags: ['Links'],
  security: [{ apiKey: [] }],
  middleware: [apiKeyAuth] as const,
  request: { body: { content: { 'application/json': { schema: createLinkSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: linkSchema } }, description: 'Link criado' },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'URL ou slug inválido' },
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Slug já existe' },
  },
});

const listLinksRoute = createRoute({
  method: 'get',
  path: '/links',
  summary: 'List links',
  description: 'Lista links com contagem de clicks, paginado. Requer `X-API-Key`.',
  tags: ['Links'],
  security: [{ apiKey: [] }],
  middleware: [apiKeyAuth] as const,
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).default(20),
      offset: z.coerce.number().min(0).default(0),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ links: z.array(linkSchema) }),
        },
      },
      description: 'Links',
    },
  },
});

const updateLinkRoute = createRoute({
  method: 'patch',
  path: '/links/{id}',
  summary: 'Update link',
  description: 'Altera destino, expiração ou status. Campos omitidos não mudam. Requer `X-API-Key`.',
  tags: ['Links'],
  security: [{ apiKey: [] }],
  middleware: [apiKeyAuth] as const,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateLinkSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: linkSchema } }, description: 'Link atualizado' },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'URL inválida' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Link não existe' },
  },
});

const deleteLinkRoute = createRoute({
  method: 'delete',
  path: '/links/{id}',
  summary: 'Deactivate link',
  description: 'Desativa o link (soft delete). Requer `X-API-Key`.',
  tags: ['Links'],
  security: [{ apiKey: [] }],
  middleware: [apiKeyAuth] as const,
  request: { params: idParam },
  responses: {
    204: { description: 'Link desativado' },
  },
});

const qrRoute = createRoute({
  method: 'get',
  path: '/links/{id}/qr.png',
  summary: 'QR code',
  description: 'PNG com QR code apontando pro link curto.',
  tags: ['Links'],
  request: {
    params: idParam,
    query: z.object({
      size: z.coerce.number().min(64).max(1024).default(256).openapi({ description: 'Lado do PNG em pixels' }),
    }),
  },
  responses: {
    200: { content: { 'image/png': { schema: z.any() } }, description: 'QR code PNG' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Link não existe' },
  },
});

export function registerLinkRoutes(app: OpenAPIHono) {
  app.openapi(createLinkRoute, async (c) => {
    const body = c.req.valid('json');
    try {
      const link = await createLink({ url: body.url, slug: body.slug, expiresAt: body.expires_at });
      return c.json(toLinkBody(link), 201);
    } catch (err) {
      if (err instanceof InvalidUrlError) return c.json({ error: 'url must be a valid http(s) URL' }, 400);
      if (err instanceof InvalidSlugError) return c.json({ error: 'slug must match ^[a-zA-Z0-9_-]{3,32}$' }, 400);
      if (err instanceof SlugTakenError) return c.json({ error: 'slug already taken' }, 409);
      throw err;
    }
  });

  app.openapi(listLinksRoute, async (c) => {
    const { limit, offset } = c.req.valid('query');
    const rows = await listLinks({ limit, offset });
    return c.json({ links: rows.map(toLinkBody) }, 200);
  });

  app.openapi(updateLinkRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    try {
      const link = await updateLink(id, { url: body.url, expiresAt: body.expires_at, active: body.active });
      return c.json(toLinkBody(link), 200);
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: 'link not found' }, 404);
      if (err instanceof InvalidUrlError) return c.json({ error: 'url must be a valid http(s) URL' }, 400);
      throw err;
    }
  });

  app.openapi(deleteLinkRoute, async (c) => {
    const { id } = c.req.valid('param');
    await deactivateLink(id);
    return c.body(null, 204);
  });

  app.openapi(qrRoute, async (c) => {
    const { id } = c.req.valid('param');
    const { size } = c.req.valid('query');
    try {
      await resolveLink(id);
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: 'link not found' }, 404);
      throw err;
    }
    const png = await QRCode.toBuffer(`${config.BASE_URL}/${id}`, { width: size, margin: 1 });
    return c.body(png.buffer as ArrayBuffer, 200, { 'Content-Type': 'image/png' });
  });

  // Registrada por último: /{id} é catch-all e não pode engolir /links.
  app.openapi(redirectRoute, async (c) => {
    const { id } = c.req.valid('param');
    let link: LinkRow;
    try {
      link = await resolveLink(id);
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: 'link not found' }, 404);
      throw err;
    }

    recordClick({
      linkId: link.id,
      userAgent: c.req.header('user-agent') ?? null,
      referrer: c.req.header('referer') ?? null,
    });

    let dest = link.url;
    const query = new URL(c.req.url).search;
    if (query) dest += (dest.includes('?') ? '&' : '?') + query.slice(1);

    return c.redirect(dest, 302);
  });
}
