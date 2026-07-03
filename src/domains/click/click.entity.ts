export interface NewClick {
  linkId: string;
  ts: Date;
  userAgent: string | null;
  referrer: string | null;
  device: string;
  isBot: boolean;
}
