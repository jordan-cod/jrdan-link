import type { z } from '@hono/zod-openapi';

import { linkRepository } from '@/container';
import type { Link, LinkPatch } from '@/domains/link/link.entity';
import { NotFoundError } from '@/domains/link/link.errors';
import type { updateLinkSchema } from '@/domains/link/link.schema';

export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;

export async function updateLink(id: string, input: UpdateLinkInput): Promise<Link> {
  const patch: LinkPatch = {};
  if (input.url !== undefined) patch.url = input.url;
  if (input.expires_at !== undefined) patch.expiresAt = input.expires_at;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length === 0) {
    const link = await linkRepository.findById(id);
    if (!link) throw new NotFoundError();
    return link;
  }

  const link = await linkRepository.update(id, patch);
  if (!link) throw new NotFoundError();
  return link;
}
