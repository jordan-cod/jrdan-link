import { Hono } from 'hono';

import { registerLinkRoutes } from './admin/links';
import type { AdminEnv } from './shared/env';

const app = new Hono<{ Bindings: AdminEnv }>();

app.use('*', async (c, next) => {
  const key = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || key !== c.env.ADMIN_API_KEY) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

registerLinkRoutes(app);

export default app;
