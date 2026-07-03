import type { LinkRow } from '@/db';
import { linkCache } from '@/domains/link/link.cache';
import { NotFoundError } from '@/domains/link/link.errors';
import { linkRepository } from '@/domains/link/link.repository';

export async function resolveLink(id: string): Promise<LinkRow> {
  let link = linkCache.get(id);
  if (!link) {
    link = await linkRepository.findActiveById(id);
    if (!link) throw new NotFoundError();
    linkCache.set(id, link);
  }

  if (link.expiresAt && link.expiresAt < new Date()) throw new NotFoundError();
  return link;
}
