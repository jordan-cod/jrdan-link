import type { Link } from '@/domains/link/link.entity';
import { linkCache } from '@/domains/link/link.cache';
import { NotFoundError } from '@/domains/link/link.errors';
import { linkRepository } from '@/container';

export async function resolveLink(id: string): Promise<Link> {
  let link = linkCache.get(id);
  if (!link) {
    link = await linkRepository.findActiveById(id);
    if (!link) throw new NotFoundError();
    linkCache.set(id, link);
  }

  if (link.expiresAt && link.expiresAt < new Date()) throw new NotFoundError();
  return link;
}
