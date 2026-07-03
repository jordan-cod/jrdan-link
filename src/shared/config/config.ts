import { z } from '@hono/zod-openapi';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  BASE_URL: z.string().default('http://app.localhost'),
  DATABASE_URL: z.string().min(1),
  API_KEY: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
});

export const config = envSchema.parse(process.env);
