import { Batcher } from '@/domains/click/click.batcher';
import type { ClickRepository } from '@/domains/click/click.repository';
import type { LinkRepository } from '@/domains/link/link.repository';
import { drizzleClickRepository } from '@/infrastructure/database/click.repository.drizzle';
import { drizzleLinkRepository } from '@/infrastructure/database/link.repository.drizzle';

export const linkRepository: LinkRepository = drizzleLinkRepository;
export const clickRepository: ClickRepository = drizzleClickRepository;

export const clickBatcher = new Batcher(clickRepository);
