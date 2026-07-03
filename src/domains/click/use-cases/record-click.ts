import { batcher } from '@/domains/click/click.batcher';
import { classify } from '@/domains/click/click.classify';

export interface RecordClickInput {
  linkId: string;
  userAgent: string | null;
  referrer: string | null;
}

export function recordClick(input: RecordClickInput): void {
  const { device, isBot } = classify(input.userAgent ?? '');
  batcher.record({
    linkId: input.linkId,
    ts: new Date(),
    userAgent: input.userAgent,
    referrer: input.referrer,
    device,
    isBot,
  });
}
