import { PostgresqlClickRepository } from '@/adapters/database/postgresql/repositories/postgresql.click.repository';
import { PostgresqlLinkRepository } from '@/adapters/database/postgresql/repositories/postgresql.link.repository';
import { BullmqQueue } from '@/adapters/queue/bullmq/bullmq.queue';
import { CLICKS_QUEUE } from '@/domains/click/click.constants';
import { ClickService } from '@/domains/click/click.service';
import type { NewClick } from '@/domains/click/click.types';
import { LinkService } from '@/domains/link/link.service';

const linkRepository = new PostgresqlLinkRepository();
export const clickRepository = new PostgresqlClickRepository();

export const clickQueue = new BullmqQueue<'record-click', NewClick>(CLICKS_QUEUE);

export const linkService = new LinkService(linkRepository);
export const clickService = new ClickService(clickQueue, clickRepository);
