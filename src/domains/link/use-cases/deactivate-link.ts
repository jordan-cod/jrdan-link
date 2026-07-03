import { linkCache } from '@/domains/link/link.cache';
import { linkRepository } from '@/domains/link/link.repository';

export async function deactivateLink(id: string): Promise<void> {
  await linkRepository.deactivate(id);
  linkCache.invalidate(id);
}
