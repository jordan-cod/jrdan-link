const BOT_PATTERN =
	/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|linkedin|skype|embedly|quora|pinterest|vkshare|w3c_validator|headless|lighthouse|curl|wget|python|go-http|okhttp|axios|node-fetch/i;
const TABLET_PATTERN = /ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i;
const MOBILE_PATTERN = /mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i;

export type Device = 'bot' | 'tablet' | 'mobile' | 'desktop';

export function deviceOf(userAgent: string | null): Device {
	if (!userAgent || BOT_PATTERN.test(userAgent)) return 'bot';
	if (TABLET_PATTERN.test(userAgent)) return 'tablet';
	if (MOBILE_PATTERN.test(userAgent)) return 'mobile';
	return 'desktop';
}

export function referrerHost(referer: string | null, ownHost: string): string {
	if (!referer) return '';
	try {
		const host = new URL(referer).hostname.replace(/^www\./, '');
		return host === ownHost ? '' : host;
	} catch {
		return '';
	}
}

const coordinate = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
};

export function clickPoint(request: Request, slug: string): AnalyticsEngineDataPoint {
	const cf = (request.cf ?? {}) as IncomingRequestCfProperties;
	const url = new URL(request.url);

	return {
		indexes: [slug],
		blobs: [
			slug,
			String(cf.country ?? ''),
			String(cf.regionCode ?? ''),
			String(cf.region ?? ''),
			String(cf.city ?? ''),
			referrerHost(request.headers.get('referer'), url.hostname),
			deviceOf(request.headers.get('user-agent')),
			crypto.randomUUID(),
		],
		doubles: [coordinate(cf.latitude), coordinate(cf.longitude)],
	};
}
