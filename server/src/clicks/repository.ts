import type { Database } from 'bun:sqlite';
import type { Click } from './click';

export interface StatsFilter {
	since: Date | null;
	until?: Date | null;
	slug: string | null;
	offsetMinutes: number;
}

export interface Count {
	key: string;
	clicks: number;
}

export interface RegionCount {
	code: string;
	name: string;
	clicks: number;
}

export interface CityCount {
	name: string;
	regionCode: string;
	region: string;
	latitude: number | null;
	longitude: number | null;
	clicks: number;
}

type Params = Record<string, string | number | null>;

const HUMAN = "device != 'bot'";

export class ClickRepository {
	constructor(private readonly db: Database) {}

	insert(clicks: Click[]): number {
		const statement = this.db.query(
			`INSERT INTO clicks (id, slug, at, country, region_code, region, city, latitude, longitude, referrer, device, weight)
			VALUES ($id, $slug, $at, $country, $regionCode, $region, $city, $latitude, $longitude, $referrer, $device, $weight)
			ON CONFLICT (id) DO NOTHING`,
		);
		let inserted = 0;
		this.db.transaction(() => {
			for (const click of clicks) {
				inserted += statement.run({
					id: click.id,
					slug: click.slug,
					at: click.at.toISOString(),
					country: click.country,
					regionCode: click.regionCode,
					region: click.region,
					city: click.city,
					latitude: click.latitude,
					longitude: click.longitude,
					referrer: click.referrer,
					device: click.device,
					weight: click.weight,
				}).changes;
			}
		})();
		return inserted;
	}

	cursor(): Date | null {
		const row = this.db.query<{ value: string }, []>("SELECT value FROM sync_state WHERE name = 'clicks_cursor'").get();
		return row ? new Date(row.value) : null;
	}

	saveCursor(at: Date): void {
		this.db
			.query(
				"INSERT INTO sync_state (name, value) VALUES ('clicks_cursor', ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value",
			)
			.run(at.toISOString());
	}

	totalsBySlug(): Map<string, number> {
		const rows = this.db
			.query<Count, []>(`SELECT slug AS key, SUM(weight) AS clicks FROM clicks WHERE ${HUMAN} GROUP BY slug`)
			.all();
		return new Map(rows.map((row) => [row.key, row.clicks]));
	}

	firstClick(filter: StatsFilter): Date | null {
		const { where, params } = this.scope(filter);
		const row = this.db
			.query<{ first: string | null }, [Params]>(`SELECT MIN(at) AS first FROM clicks ${where}`)
			.get(params);
		return row?.first ? new Date(row.first) : null;
	}

	total(filter: StatsFilter, humans = true): number {
		const { where, params } = this.scope(filter, humans ? HUMAN : "device = 'bot'");
		const row = this.db
			.query<{ clicks: number | null }, [Params]>(`SELECT SUM(weight) AS clicks FROM clicks ${where}`)
			.get(params);
		return row?.clicks ?? 0;
	}

	distinctCities(filter: StatsFilter): number {
		const { where, params } = this.scope(filter, "city != ''");
		const row = this.db
			.query<{ cities: number }, [Params]>(
				`SELECT COUNT(DISTINCT country || '|' || region_code || '|' || city) AS cities FROM clicks ${where}`,
			)
			.get(params);
		return row?.cities ?? 0;
	}

	byDay(filter: StatsFilter): Count[] {
		const { where, params } = this.scope(filter);
		return this.db
			.query<Count, [Params]>(
				`SELECT date(at, $offset) AS key, SUM(weight) AS clicks FROM clicks ${where} GROUP BY key ORDER BY key`,
			)
			.all({ ...params, offset: `${filter.offsetMinutes >= 0 ? '+' : ''}${filter.offsetMinutes} minutes` });
	}

	groupBy(filter: StatsFilter, column: 'country' | 'slug' | 'referrer' | 'device'): Count[] {
		const { where, params } = this.scope(filter);
		return this.db
			.query<Count, [Params]>(
				`SELECT ${column} AS key, SUM(weight) AS clicks FROM clicks ${where} GROUP BY ${column} ORDER BY clicks DESC`,
			)
			.all(params);
	}

	regions(filter: StatsFilter, country: string): RegionCount[] {
		const { where, params } = this.scope(filter, 'country = $country');
		return this.db
			.query<RegionCount, [Params]>(
				`SELECT region_code AS code, MAX(region) AS name, SUM(weight) AS clicks
				FROM clicks ${where} GROUP BY region_code ORDER BY clicks DESC`,
			)
			.all({ ...params, country });
	}

	cities(filter: StatsFilter, country: string): CityCount[] {
		const { where, params } = this.scope(filter, 'country = $country');
		return this.db
			.query<CityCount, [Params]>(
				`SELECT city AS name, region_code AS regionCode, MAX(region) AS region,
					AVG(latitude) AS latitude, AVG(longitude) AS longitude, SUM(weight) AS clicks
				FROM clicks ${where} GROUP BY city, region_code ORDER BY clicks DESC`,
			)
			.all({ ...params, country });
	}

	private scope(filter: StatsFilter, ...extra: string[]): { where: string; params: Params } {
		const conditions = [...extra];
		const params: Params = {};
		if (!extra.some((condition) => condition.startsWith('device'))) conditions.unshift(HUMAN);
		if (filter.since) {
			conditions.push('at >= $since');
			params.since = filter.since.toISOString();
		}
		if (filter.until) {
			conditions.push('at < $until');
			params.until = filter.until.toISOString();
		}
		if (filter.slug) {
			conditions.push('slug = $slug');
			params.slug = filter.slug;
		}
		return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
	}
}
