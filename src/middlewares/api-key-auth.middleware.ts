import type { MiddlewareHandler } from 'hono';

import { config } from '@/shared/config/config';
import { UnauthorizedError } from '@/shared/error-handling/app-error';

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header('x-api-key') !== config.API_KEY) {
    throw new UnauthorizedError('auth.invalid_api_key', 'unauthorized');
  }
  await next();
};
