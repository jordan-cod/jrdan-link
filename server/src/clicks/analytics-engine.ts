import type { Click, ClickSource } from './click';

interface AnalyticsEngineOptions {
	apiToken: string;
	accountId: string;
	dataset: string;
	fetch?: typeof fetch;
}

interface Row {
	id: string;
	at: string;
	slug: string;
	country: string;
	region_code: string;
	region: string;
	city: string;
	referrer: string;
	device: string;
	latitude: number;
	longitude: number;
	weight: number;
}

const DATASET_PATTERN = /^[a-zA-Z0-9_]+$/;

const sqlTime = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

export class AnalyticsEngineSource implements ClickSource {
	private readonly fetch: typeof fetch;

	constructor(private readonly options: AnalyticsEngineOptions) {
		if (!DATASET_PATTERN.test(options.dataset)) throw new Error(`Invalid dataset name ${options.dataset}`);
		this.fetch = options.fetch ?? fetch;
	}

	async since(from: Date, limit: number): Promise<Click[]> {
		const query = `
			SELECT blob8 AS id, timestamp AS at, blob1 AS slug, blob2 AS country, blob3 AS region_code,
				blob4 AS region, blob5 AS city, blob6 AS referrer, blob7 AS device,
				double1 AS latitude, double2 AS longitude, _sample_interval AS weight
			FROM ${this.options.dataset}
			WHERE timestamp >= toDateTime('${sqlTime(from)}')
			ORDER BY timestamp
			LIMIT ${Math.floor(limit)}
			FORMAT JSON`;

		const response = await this.fetch(
			`https://api.cloudflare.com/client/v4/accounts/${this.options.accountId}/analytics_engine/sql`,
			{ method: 'POST', headers: { Authorization: `Bearer ${this.options.apiToken}` }, body: query },
		);

		if (!response.ok) {
			throw new Error(`Analytics Engine answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
		}

		const body = (await response.json()) as { data: Row[] };
		return body.data
			.filter((row) => row.id)
			.map((row) => ({
				id: row.id,
				slug: row.slug,
				at: new Date(`${row.at.replace(' ', 'T')}Z`),
				country: row.country,
				regionCode: row.region_code,
				region: row.region,
				city: row.city,
				latitude: row.latitude || null,
				longitude: row.longitude || null,
				referrer: row.referrer,
				device: row.device,
				weight: Math.max(1, Math.round(Number(row.weight) || 1)),
			}));
	}
}
