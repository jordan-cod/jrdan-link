import { linkRepository } from '@/container';

export async function deactivateLink(id: string): Promise<void> {
  await linkRepository.deactivate(id);
}
