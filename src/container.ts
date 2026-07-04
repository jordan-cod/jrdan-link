import { PostgresqlClickRepository } from '@/adapters/database/postgresql/repositories/postgresql.click.repository';
import { PostgresqlLinkRepository } from '@/adapters/database/postgresql/repositories/postgresql.link.repository';
import { ClickBatcher } from '@/domains/click/click.batcher';
import { ClickService } from '@/domains/click/click.service';
import { LinkService } from '@/domains/link/link.service';

const linkRepository = new PostgresqlLinkRepository();
const clickRepository = new PostgresqlClickRepository();

export const clickBatcher = new ClickBatcher(clickRepository);

export const linkService = new LinkService(linkRepository);
export const clickService = new ClickService(clickBatcher);
