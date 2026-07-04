import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { AppError } from '@/shared/error-handling/app-error';
import { logger } from '@/shared/logger/logger';

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json({ code: err.code, error: err.message }, err.statusCode);
  }

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  logger.error({ err }, 'unhandled error');
  return c.json({ code: 'internal_error', error: 'internal error' }, 500);
}
