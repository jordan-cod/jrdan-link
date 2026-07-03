import type { Link } from '@/domains/link/link.entity';
import { linkRepository } from '@/container';

export interface ListLinksInput {
  limit: number;
  offset: number;
}

export async function listLinks(input: ListLinksInput): Promise<Link[]> {
  return linkRepository.list(input.limit, input.offset);
}
