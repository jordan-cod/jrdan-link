import { z } from '@hono/zod-openapi';

export const errorResponseSchema = z
  .object({
    code: z.string().openapi({ example: 'link.not_found' }),
    error: z.string().openapi({ example: 'link not found' }),
  })
  .openapi('Error');
