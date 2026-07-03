import type { z } from '@hono/zod-openapi';

import { linkRepository } from '@/container';
import type { Link } from '@/domains/link/link.entity';
import type { listLinksQuerySchema } from '@/domains/link/link.schema';

export type ListLinksInput = z.infer<typeof listLinksQuerySchema>;

export async function listLinks(input: ListLinksInput): Promise<Link[]> {
  return linkRepository.list(input.limit, input.offset);
}
