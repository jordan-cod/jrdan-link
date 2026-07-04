import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import QRCode from 'qrcode';

import { ClickService } from '@/domains/click/click.service';
import {
  createLinkSchema,
  linkIdParamSchema,
  linkResponseSchema,
  listLinksQuerySchema,
  qrQuerySchema,
  updateLinkSchema,
} from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';
import type { Link } from '@/domains/link/link.types';
import { config } from '@/shared/config/config';
import { errorResponseSchema } from '@/shared/schemas/error.schema';

function toLinkResponse(link: Link): z.infer<typeof linkResponseSchema> {
  return {
    id: link.id,
    url: link.url,
    short_url: `${config.BASE_URL}/${link.id}`,
    active: link.active,
    created_at: link.createdAt.toISOString(),
    expires_at: link.expiresAt?.toISOString() ?? null,
  };
}

const createLink = createRoute({
  method: 'post',
  path: '/links',
  summary: 'Create short link',
  description: 'Encurta uma URL, com slug customizado opcional.',
  tags: ['Links'],
  request: { body: { content: { 'application/json': { schema: createLinkSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: linkResponseSchema } }, description: 'Link criado' },
    409: { content: { 'application/json': { schema: errorResponseSchema } }, description: 'Slug já existe' },
  },
});

const listLinks = createRoute({
  method: 'get',
  path: '/links',
  summary: 'List links',
  description: 'Lista links, paginado.',
  tags: ['Links'],
  request: { query: listLinksQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ links: z.array(linkResponseSchema) }) } },
      description: 'Links',
    },
  },
});

const updateLink = createRoute({
  method: 'patch',
  path: '/links/{id}',
  summary: 'Update link',
  description: 'Altera destino, expiração ou status. Campos omitidos não mudam.',
  tags: ['Links'],
  request: {
    params: linkIdParamSchema,
    body: { content: { 'application/json': { schema: updateLinkSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: linkResponseSchema } }, description: 'Link atualizado' },
    404: { content: { 'application/json': { schema: errorResponseSchema } }, description: 'Link não existe' },
  },
});

const deleteLink = createRoute({
  method: 'delete',
  path: '/links/{id}',
  summary: 'Deactivate link',
  description: 'Desativa o link (soft delete).',
  tags: ['Links'],
  request: { params: linkIdParamSchema },
  responses: {
    204: { description: 'Link desativado' },
  },
});

const getLinkQr = createRoute({
  method: 'get',
  path: '/links/{id}/qr.png',
  summary: 'QR code',
  description: 'PNG com QR code apontando pro link curto.',
  tags: ['Links'],
  request: { params: linkIdParamSchema, query: qrQuerySchema },
  responses: {
    200: { content: { 'image/png': { schema: z.any() } }, description: 'QR code PNG' },
    404: { content: { 'application/json': { schema: errorResponseSchema } }, description: 'Link não existe' },
  },
});

const redirect = createRoute({
  method: 'get',
  path: '/{id}',
  summary: 'Redirect to destination',
  description: 'Redireciona pro destino registrado, repassando query params, e registra o click de forma assíncrona.',
  tags: ['Links'],
  request: { params: linkIdParamSchema },
  responses: {
    302: { description: 'Redirect pro destino' },
    404: { content: { 'application/json': { schema: errorResponseSchema } }, description: 'Link não existe' },
  },
});

export function registerLinkRoutes(app: OpenAPIHono) {
  app.openapi(createLink, async (c) => {
    const link = await new LinkService().createLink(c.req.valid('json'));
    return c.json(toLinkResponse(link), 201);
  });

  app.openapi(listLinks, async (c) => {
    const links = await new LinkService().listLinks(c.req.valid('query'));
    return c.json({ links: links.map(toLinkResponse) }, 200);
  });

  app.openapi(updateLink, async (c) => {
    const link = await new LinkService().updateLink(c.req.valid('param').id, c.req.valid('json'));
    return c.json(toLinkResponse(link), 200);
  });

  app.openapi(deleteLink, async (c) => {
    await new LinkService().deactivateLink(c.req.valid('param').id);
    return c.body(null, 204);
  });

  app.openapi(getLinkQr, async (c) => {
    const link = await new LinkService().resolveLink(c.req.valid('param').id);
    const png = await QRCode.toBuffer(`${config.BASE_URL}/${link.id}`, {
      width: c.req.valid('query').size,
      margin: 1,
    });
    return c.body(png.buffer as ArrayBuffer, 200, { 'Content-Type': 'image/png' });
  });

  // Por último: /{id} é catch-all e não pode engolir /links.
  app.openapi(redirect, async (c) => {
    const linkService = new LinkService();
    const link = await linkService.resolveLink(c.req.valid('param').id);

    new ClickService().recordClick({
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
