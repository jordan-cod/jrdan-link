import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { linkIdParamSchema } from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';

const route = createRoute({
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

export function registerDeleteLinkRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const linkService = new LinkService();
    await linkService.deactivateLink(c.req.valid('param').id);
    return c.body(null, 204);
  });
}
