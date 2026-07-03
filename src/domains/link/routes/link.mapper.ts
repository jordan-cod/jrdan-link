import type { z } from '@hono/zod-openapi';

import type { linkResponseSchema } from '@/domains/link/link.schema';
import type { Link } from '@/domains/link/link.types';
import { config } from '@/shared/config/config';

export function toLinkResponse(link: Link): z.infer<typeof linkResponseSchema> {
  return {
    id: link.id,
    url: link.url,
    short_url: `${config.BASE_URL}/${link.id}`,
    active: link.active,
    created_at: link.createdAt.toISOString(),
    expires_at: link.expiresAt?.toISOString() ?? null,
  };
}
