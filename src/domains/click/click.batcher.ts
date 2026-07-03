import type { NewClick } from '@/domains/click/click.entity';
import type { ClickRepository } from '@/domains/click/click.repository';
import { logger } from '@/logger';

const MAX_BUFFER = 10_000;
const MAX_BATCH = 1_000;
const FLUSH_INTERVAL_MS = 500;

// Acumula clicks em memória e grava em lote, mantendo o write
// fora do hot path do redirect.
export class Batcher {
  private buffer: NewClick[] = [];
  private timer: Timer | null = null;

  constructor(private readonly repository: ClickRepository) {}

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
      await this.repository.insertMany(batch);
    } catch (err) {
      logger.error({ err, count: batch.length }, 'flush clicks failed');
    }
  }

  async close() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}
