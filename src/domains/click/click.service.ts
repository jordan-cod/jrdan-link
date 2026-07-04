import { isbot } from 'isbot';
import { UAParser } from 'ua-parser-js';

import type { Queue } from '@/adapters/queue/queue.interface';
import type { IClickRepository } from '@/domains/click/click.repository.interface';
import type { Device, NewClick, RecordClickInput } from '@/domains/click/click.types';

export class ClickService {
  constructor(
    private readonly clickQueue: Queue<'record-click', NewClick>,
    private readonly clickRepository: IClickRepository,
  ) {}

  async recordClick(input: RecordClickInput): Promise<void> {
    const { device, isBot } = this.classify(input.userAgent ?? '');
    await this.clickQueue.enqueue('record-click', {
      linkId: input.linkId,
      ts: new Date(),
      userAgent: input.userAgent,
      referrer: input.referrer,
      device,
      isBot,
    });
  }

  async persistClick(click: NewClick): Promise<void> {
    await this.clickRepository.insertMany([{ ...click, ts: new Date(click.ts) }]);
  }

  private classify(ua: string): { device: Device; isBot: boolean } {
    if (!ua) return { device: 'unknown', isBot: true };
    if (isbot(ua)) return { device: 'unknown', isBot: true };

    const parsed = UAParser(ua);
    switch (parsed.device.type) {
      case 'mobile':
        return { device: 'mobile', isBot: false };
      case 'tablet':
        return { device: 'tablet', isBot: false };
      default:
        return { device: parsed.browser.name ? 'desktop' : 'unknown', isBot: false };
    }
  }
}
