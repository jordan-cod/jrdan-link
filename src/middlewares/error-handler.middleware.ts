import type { Context } from 'hono';

import { AppError } from '@/shared/error-handling/app-error';
import { logger } from '@/shared/logger/logger';

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json({ code: err.code, error: err.message }, err.statusCode as 404 | 409);
  }

  logger.error({ err }, 'unhandled error');
  return c.json({ code: 'internal_error', error: 'internal error' }, 500);
}
