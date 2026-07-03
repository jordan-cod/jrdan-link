import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { linkIdParamSchema, linkResponseSchema, updateLinkSchema } from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';
import { toLinkResponse } from '@/domains/link/routes/link.mapper';
import { apiKeyAuth } from '@/middlewares/api-key-auth.middleware';
import { errorResponseSchema } from '@/shared/schemas/error.schema';

const route = createRoute({
  method: 'patch',
  path: '/links/{id}',
  summary: 'Update link',
  description: 'Altera destino, expiração ou status. Campos omitidos não mudam. Requer `X-API-Key`.',
  tags: ['Links'],
  security: [{ apiKey: [] }],
  middleware: [apiKeyAuth] as const,
  request: {
    params: linkIdParamSchema,
    body: { content: { 'application/json': { schema: updateLinkSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: linkResponseSchema } }, description: 'Link atualizado' },
    404: { content: { 'application/json': { schema: errorResponseSchema } }, description: 'Link não existe' },
  },
});

export function registerUpdateLinkRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const linkService = new LinkService();
    const link = await linkService.updateLink(c.req.valid('param').id, c.req.valid('json'));
    return c.json(toLinkResponse(link), 200);
  });
}
