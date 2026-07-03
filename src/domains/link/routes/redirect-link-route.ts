import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { ClickService } from '@/domains/click/click.service';
import { linkIdParamSchema } from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';
import { errorResponseSchema } from '@/shared/schemas/error.schema';

const route = createRoute({
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

export function registerRedirectLinkRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const linkService = new LinkService();
    const clickService = new ClickService();

    const link = await linkService.resolveLink(c.req.valid('param').id);

    clickService.recordClick({
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
