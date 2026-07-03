import { linkRepository } from '@/container';
import type { Link } from '@/domains/link/link.entity';
import { NotFoundError } from '@/domains/link/link.errors';

export async function resolveLink(id: string): Promise<Link> {
  const link = await linkRepository.findActiveById(id);
  if (!link) throw new NotFoundError();
  if (link.expiresAt && link.expiresAt < new Date()) throw new NotFoundError();
  return link;
}
