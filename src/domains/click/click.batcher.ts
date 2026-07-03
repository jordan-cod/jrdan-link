import { sql } from '@/db';

export interface ClickEvent {
  link_id: string;
  ts: Date;
  user_agent: string | null;
  referrer: string | null;
  device: string;
  is_bot: boolean;
}

const MAX_BUFFER = 10_000;
const MAX_BATCH = 1_000;
const FLUSH_INTERVAL_MS = 500;

// Acumula clicks em memória e grava em lote, mantendo o write
// fora do hot path do redirect.
class Batcher {
  private buffer: ClickEvent[] = [];
  private timer: Timer | null = null;

  start() {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  record(event: ClickEvent) {
    if (this.buffer.length >= MAX_BUFFER) {
      console.warn(`click dropped: buffer full (link_id=${event.link_id})`);
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
      await sql`INSERT INTO clicks ${sql(batch)}`;
    } catch (err) {
      console.error(`flush clicks failed (count=${batch.length})`, err);
    }
  }

  async close() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}

export const batcher = new Batcher();
