import type { LinkRow } from '@/db';
import { linkCache } from '@/domains/link/link.cache';
import { NotFoundError } from '@/domains/link/link.errors';
import { linkRepository, type LinkPatch } from '@/domains/link/link.repository';
import { validateUrl } from '@/domains/link/link.validation';

export interface UpdateLinkInput {
  url?: string;
  expiresAt?: Date;
  active?: boolean;
}

export async function updateLink(id: string, input: UpdateLinkInput): Promise<LinkRow> {
  const patch: LinkPatch = {};
  if (input.url !== undefined) {
    validateUrl(input.url);
    patch.url = input.url;
  }
  if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length === 0) {
    const link = await linkRepository.findById(id);
    if (!link) throw new NotFoundError();
    return link;
  }

  const link = await linkRepository.update(id, patch);
  if (!link) throw new NotFoundError();

  linkCache.invalidate(id);
  return link;
}

