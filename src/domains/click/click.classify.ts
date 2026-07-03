import { isbot } from 'isbot';
import { UAParser } from 'ua-parser-js';

export type Device = 'mobile' | 'tablet' | 'desktop' | 'unknown';

// Segue a convenção dos grandes (Dub, Plausible): só marca bot quando
// positivamente identificado; UA desconhecido conta como humano.
export function classify(ua: string): { device: Device; isBot: boolean } {
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
