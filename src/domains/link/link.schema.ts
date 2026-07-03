import { z } from '@hono/zod-openapi';

export const linkIdParamSchema = z.object({
  id: z.string().openapi({ example: 'aB3xK9pQ' }),
});

export const linkResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'aB3xK9pQ' }),
    url: z.string().openapi({ example: 'https://github.com' }),
    short_url: z.string().openapi({ example: 'http://app.localhost/aB3xK9pQ' }),
    active: z.boolean(),
    created_at: z.string().datetime(),
    expires_at: z.string().datetime().nullable(),
  })
  .openapi('Link');

export const createLinkSchema = z.object({
  url: z
    .url({ protocol: /^https?$/ })
    .openapi({ description: 'URL destino (http/https)', example: 'https://github.com' }),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/)
    .optional()
    .openapi({ description: 'Slug customizado (3-32 chars: a-z A-Z 0-9 _ -)', example: 'promo' }),
  expires_at: z.coerce.date().optional().openapi({ description: 'Expiração opcional' }),
});

export const updateLinkSchema = z.object({
  url: z
    .url({ protocol: /^https?$/ })
    .optional()
    .openapi({ description: 'Novo destino (http/https)' }),
  expires_at: z.coerce.date().optional().openapi({ description: 'Nova expiração' }),
  active: z.boolean().optional().openapi({ description: 'Ativar/desativar' }),
});

export const listLinksQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const qrQuerySchema = z.object({
  size: z.coerce.number().min(64).max(1024).default(256).openapi({ description: 'Lado do PNG em pixels' }),
});
