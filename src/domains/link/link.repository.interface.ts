import type { Link, LinkPatch, NewLink } from '@/domains/link/link.types';

export interface ILinkRepository {
  findActiveById(id: string): Promise<Link | undefined>;
  findById(id: string): Promise<Link | undefined>;
  insert(link: NewLink): Promise<Link>;
  update(id: string, patch: LinkPatch): Promise<Link | undefined>;
  deactivate(id: string): Promise<void>;
  list(limit: number, offset: number): Promise<Link[]>;
}
