import type { ClickRepository, StatsFilter } from './repository';

export const RANGES = { '7d': 7, '30d': 30, '90d': 90, all: null } as const;
export type Range = keyof typeof RANGES;

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterFor(range: Range, slug: string | null, offsetMinutes: number, now = new Date()): StatsFilter {
	const days = RANGES[range];
	if (days === null) return { since: null, slug, offsetMinutes };
	const local = new Date(now.getTime() + offsetMinutes * 60_000);
	const startOfToday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
	return { since: new Date(startOfToday - (days - 1) * DAY_MS - offsetMinutes * 60_000), slug, offsetMinutes };
}

function dayKeys(from: Date, to: Date, offsetMinutes: number): string[] {
	const shift = (date: Date) => new Date(date.getTime() + offsetMinutes * 60_000);
	const keys: string[] = [];
	const cursor = shift(from);
	cursor.setUTCHours(0, 0, 0, 0);
	const end = shift(to);
	while (cursor <= end) {
		keys.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return keys;
}

export function overview(clicks: ClickRepository, filter: StatsFilter, now = new Date()) {
	const counts = new Map(clicks.byDay(filter).map((row) => [row.key, row.clicks]));
	const first = filter.since ?? clicks.firstClick(filter) ?? now;

	return {
		total: clicks.total(filter),
		bots: clicks.total(filter, false),
		series: dayKeys(first, now, filter.offsetMinutes).map((date) => ({ date, clicks: counts.get(date) ?? 0 })),
		countries: clicks.groupBy(filter, 'country').map((row) => ({ code: row.key, clicks: row.clicks })),
		links: clicks.groupBy(filter, 'slug').map((row) => ({ slug: row.key, clicks: row.clicks })),
		referrers: clicks.groupBy(filter, 'referrer').map((row) => ({ host: row.key, clicks: row.clicks })),
		devices: clicks.groupBy(filter, 'device').map((row) => ({ device: row.key, clicks: row.clicks })),
	};
}

export function country(clicks: ClickRepository, filter: StatsFilter, code: string) {
	return {
		country: code,
		total: clicks.regions(filter, code).reduce((sum, region) => sum + region.clicks, 0),
		regions: clicks.regions(filter, code),
		cities: clicks.cities(filter, code),
	};
}
