import type { MiddlewareHandler } from 'hono';

import { config } from '@/config';

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header('x-api-key') !== config.API_KEY) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};
