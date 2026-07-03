import type { LinkRow } from '@/db';
import { linkRepository } from '@/domains/link/link.repository';

export interface ListLinksInput {
  limit: number;
  offset: number;
}

export async function listLinks(input: ListLinksInput): Promise<LinkRow[]> {
  return linkRepository.list(input.limit, input.offset);
}
