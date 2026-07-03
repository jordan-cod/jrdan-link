import { PostgresqlClickRepository } from '@/adapters/database/postgresql/repositories/postgresql.click.repository';

import type { IClickRepository } from '@/domains/click/click.repository.interface';
import type { NewClick } from '@/domains/click/click.types';
import { logger } from '@/shared/logger/logger';

const MAX_BUFFER = 10_000;
const MAX_BATCH = 1_000;
const FLUSH_INTERVAL_MS = 500;

// Acumula clicks em memória e grava em lote, mantendo o write
// fora do hot path do redirect.
export class ClickBatcher {
  private buffer: NewClick[] = [];
  private timer: Timer | null = null;

  constructor(private readonly clickRepository: IClickRepository) {}

  start() {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  record(event: NewClick) {
    if (this.buffer.length >= MAX_BUFFER) {
      logger.warn({ linkId: event.linkId }, 'click dropped: buffer full');
      return;
    }
    this.buffer.push(event);
    if (this.buffer.length >= MAX_BATCH) void this.flush();
  }

  async flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.clickRepository.insertMany(batch);
    } catch (err) {
      logger.error({ err, count: batch.length }, 'flush clicks failed');
    }
  }

  async close() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}

// Singleton: o buffer precisa ser compartilhado entre requests.
export const clickBatcher = new ClickBatcher(new PostgresqlClickRepository());
