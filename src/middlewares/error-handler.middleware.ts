import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { isHttpError } from 'http-errors';

import { logger } from '@/shared/logger/logger';

export function errorHandler(err: Error, c: Context): Response {
  if (isHttpError(err)) {
    const message = err.expose ? err.message : 'Internal Server Error';
    return c.json({ error: message }, err.status as ContentfulStatusCode);
  }

  logger.error({ err }, 'unhandled error');
  return c.json({ error: 'Internal Server Error' }, 500);
}
