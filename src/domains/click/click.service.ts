import { isbot } from 'isbot';
import { UAParser } from 'ua-parser-js';

import { clickBatcher } from '@/domains/click/click.batcher';
import type { Device, RecordClickInput } from '@/domains/click/click.types';

export class ClickService {
  recordClick(input: RecordClickInput): void {
    const { device, isBot } = this.classify(input.userAgent ?? '');
    clickBatcher.record({
      linkId: input.linkId,
      ts: new Date(),
      userAgent: input.userAgent,
      referrer: input.referrer,
      device,
      isBot,
    });
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
