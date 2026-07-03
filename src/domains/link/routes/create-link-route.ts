import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { createLinkSchema, linkResponseSchema } from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';
import { toLinkResponse } from '@/domains/link/routes/link.mapper';
import { errorResponseSchema } from '@/shared/schemas/error.schema';

const route = createRoute({
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

export function registerCreateLinkRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const linkService = new LinkService();
    const link = await linkService.createLink(c.req.valid('json'));
    return c.json(toLinkResponse(link), 201);
  });
}
