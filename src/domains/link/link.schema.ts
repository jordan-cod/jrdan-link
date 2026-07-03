import { z } from '@hono/zod-openapi';

export const linkSchema = z
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
  url: z.string().openapi({ description: 'URL destino', example: 'https://github.com' }),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/)
    .optional()
    .openapi({ description: 'Slug customizado (3-32 chars: a-z A-Z 0-9 _ -)', example: 'promo' }),
  expires_at: z.coerce.date().optional().openapi({ description: 'Expiração opcional' }),
});

export const updateLinkSchema = z.object({
  url: z.string().optional().openapi({ description: 'Novo destino' }),
  expires_at: z.coerce.date().optional().openapi({ description: 'Nova expiração' }),
  active: z.boolean().optional().openapi({ description: 'Ativar/desativar' }),
});

const namedClicksSchema = z.object({
  name: z.string().openapi({ example: 'mobile' }),
  clicks: z.number(),
});

export const statsSchema = z
  .object({
    total_clicks: z.number(),
    clicks_24h: z.number(),
    clicks_7d: z.number(),
    daily: z.array(z.object({ day: z.string().openapi({ example: '2026-07-02' }), clicks: z.number() })),
    top_referrers: z.array(namedClicksSchema),
    devices: z.array(namedClicksSchema),
  })
  .openapi('LinkStats');

export const errorSchema = z.object({ error: z.string() }).openapi('Error');
