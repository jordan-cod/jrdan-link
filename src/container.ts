import { PostgresqlClickRepository } from '@/adapters/database/postgresql/repositories/postgresql.click.repository';
import { PostgresqlLinkRepository } from '@/adapters/database/postgresql/repositories/postgresql.link.repository';
import { BullmqClickQueue } from '@/adapters/queue/bullmq/bullmq.click.queue';
import { ClickService } from '@/domains/click/click.service';
import { LinkService } from '@/domains/link/link.service';

const linkRepository = new PostgresqlLinkRepository();
export const clickRepository = new PostgresqlClickRepository();

export const clickQueue = new BullmqClickQueue();

export const linkService = new LinkService(linkRepository);
export const clickService = new ClickService(clickQueue);
