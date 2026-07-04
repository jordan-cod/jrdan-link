import { isUniqueViolation } from '@/adapters/database/postgresql/postgresql.errors';

import { linkNotFound, slugTaken } from '@/domains/link/link.exceptions';
import type { ILinkRepository } from '@/domains/link/link.repository.interface';
import type { CreateLinkInput, Link, LinkPatch, ListLinksInput, UpdateLinkInput } from '@/domains/link/link.types';
import { newShortId } from '@/shared/crypto/short-id';

const ID_LENGTH = 8;
const MAX_ID_ATTEMPTS = 3;

export class LinkService {
  constructor(private readonly linkRepository: ILinkRepository) {}

  async resolveLink(id: string): Promise<Link> {
    const link = await this.linkRepository.findActiveById(id);
    if (!link) throw linkNotFound(id);
    if (link.expiresAt && link.expiresAt < new Date()) throw linkNotFound(id);
    return link;
  }

  async createLink(input: CreateLinkInput): Promise<Link> {
    if (input.slug) {
      try {
        return await this.linkRepository.insert({ id: input.slug, url: input.url, expiresAt: input.expires_at });
      } catch (err) {
        if (isUniqueViolation(err)) throw slugTaken(input.slug);
        throw err;
      }
    }

    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      try {
        return await this.linkRepository.insert({ id: newShortId(ID_LENGTH), url: input.url, expiresAt: input.expires_at });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new Error('could not generate unique short id');
  }

  async updateLink(id: string, input: UpdateLinkInput): Promise<Link> {
    const patch: LinkPatch = {};
    if (input.url !== undefined) patch.url = input.url;
    if (input.expires_at !== undefined) patch.expiresAt = input.expires_at;
    if (input.active !== undefined) patch.active = input.active;

    if (Object.keys(patch).length === 0) {
      const link = await this.linkRepository.findById(id);
      if (!link) throw linkNotFound(id);
      return link;
    }

    const link = await this.linkRepository.update(id, patch);
    if (!link) throw linkNotFound(id);
    return link;
  }

  async deactivateLink(id: string): Promise<void> {
    await this.linkRepository.deactivate(id);
  }

  async listLinks(input: ListLinksInput): Promise<Link[]> {
    return this.linkRepository.list(input.limit, input.offset);
  }
}
