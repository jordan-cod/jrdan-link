import { isbot } from 'isbot';
import { UAParser } from 'ua-parser-js';

import type { IClickQueue } from '@/domains/click/click.queue.interface';
import type { IClickRepository } from '@/domains/click/click.repository.interface';
import type { Device, NewClick, RecordClickInput } from '@/domains/click/click.types';

export class ClickService {
  constructor(
    private readonly clickQueue: IClickQueue,
    private readonly clickRepository: IClickRepository,
  ) {}

  // Produtor: classifica o UA e enfileira o click (chamado no hot path do redirect).
  async recordClick(input: RecordClickInput): Promise<void> {
    const { device, isBot } = this.classify(input.userAgent ?? '');
    await this.clickQueue.enqueue({
      linkId: input.linkId,
      ts: new Date(),
      userAgent: input.userAgent,
      referrer: input.referrer,
      device,
      isBot,
    });
  }

  // Consumidor: persiste um click já enfileirado (chamado pelo worker).
  async persistClick(click: NewClick): Promise<void> {
    await this.clickRepository.insertMany([click]);
  }

  // Segue a convenção dos grandes (Dub, Plausible): só marca bot quando
  // positivamente identificado; UA desconhecido conta como humano.
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
