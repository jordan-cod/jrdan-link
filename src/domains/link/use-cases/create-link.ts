import type { LinkRow } from '@/db';
import { InvalidSlugError, SlugTakenError } from '@/domains/link/link.errors';
import { linkRepository } from '@/domains/link/link.repository';
import { validateUrl } from '@/domains/link/link.validation';
import { isUniqueViolation } from '@/shared/postgres-errors';
import { newShortId } from '@/shared/short-id';

const SLUG_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const ID_LENGTH = 8;
const MAX_ID_ATTEMPTS = 3;

export interface CreateLinkInput {
  url: string;
  slug?: string;
  expiresAt?: Date;
}

export async function createLink(input: CreateLinkInput): Promise<LinkRow> {
  validateUrl(input.url);

  if (input.slug) {
    if (!SLUG_PATTERN.test(input.slug)) throw new InvalidSlugError();
    try {
      return await linkRepository.insert({ id: input.slug, url: input.url, expiresAt: input.expiresAt });
    } catch (err) {
      if (isUniqueViolation(err)) throw new SlugTakenError();
      throw err;
    }
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    try {
      return await linkRepository.insert({ id: newShortId(ID_LENGTH), url: input.url, expiresAt: input.expiresAt });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('could not generate unique short id');
}

