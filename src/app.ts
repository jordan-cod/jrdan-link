import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { registerLinkRoutes } from '@/domains/link/link.routes';
import { errorHandler } from '@/middlewares/error-handler.middleware';

const SCALAR_HTML = `<!doctype html>
<html>
  <head>
    <title>Tracker API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

const healthRoute = createRoute({
  method: 'get',
  path: '/healthz',
  summary: 'Health check',
  tags: ['System'],
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.string() }) } },
      description: 'OK',
    },
  },
});

export function buildApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.onError(errorHandler);

  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Tracker API',
      version: '0.1.0',
      description: 'Encurtador de URLs com tracking de cliques.',
    },
  });

  app.get('/docs', (c) => c.html(SCALAR_HTML));

  app.openapi(healthRoute, (c) => c.json({ status: 'ok' }, 200));

  registerLinkRoutes(app);

  return app;
}
