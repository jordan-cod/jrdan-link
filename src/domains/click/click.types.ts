export interface NewClick {
  linkId: string;
  ts: Date;
  userAgent: string | null;
  referrer: string | null;
  device: Device;
  isBot: boolean;
}

export type Device = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export interface RecordClickInput {
  linkId: string;
  userAgent: string | null;
  referrer: string | null;
}
