import type { z } from '@hono/zod-openapi';

import { linkRepository } from '@/container';
import type { Link } from '@/domains/link/link.entity';
import { SlugTakenError } from '@/domains/link/link.errors';
import type { createLinkSchema } from '@/domains/link/link.schema';
import { isUniqueViolation } from '@/shared/postgres-errors';
import { newShortId } from '@/shared/short-id';

const ID_LENGTH = 8;
const MAX_ID_ATTEMPTS = 3;

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export async function createLink(input: CreateLinkInput): Promise<Link> {
  if (input.slug) {
    try {
      return await linkRepository.insert({ id: input.slug, url: input.url, expiresAt: input.expires_at });
    } catch (err) {
      if (isUniqueViolation(err)) throw new SlugTakenError();
      throw err;
    }
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    try {
      return await linkRepository.insert({ id: newShortId(ID_LENGTH), url: input.url, expiresAt: input.expires_at });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('could not generate unique short id');
}
