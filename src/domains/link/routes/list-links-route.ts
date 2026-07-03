import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import { linkResponseSchema, listLinksQuerySchema } from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';
import { toLinkResponse } from '@/domains/link/routes/link.mapper';

const route = createRoute({
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

export function registerListLinksRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const linkService = new LinkService();
    const links = await linkService.listLinks(c.req.valid('query'));
    return c.json({ links: links.map(toLinkResponse) }, 200);
  });
}
