import { z } from '@hono/zod-openapi';

export const errorResponseSchema = z
  .object({
    error: z.string().openapi({ example: 'link "aB3xK9pQ" not found' }),
  })
  .openapi('Error');
