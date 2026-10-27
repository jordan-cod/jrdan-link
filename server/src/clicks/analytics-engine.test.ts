import { describe, expect, test } from 'bun:test';
import { AnalyticsEngineSource } from './analytics-engine';

function sourceAnswering(body: unknown, status = 200) {
	const sent: string[] = [];
	const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
		sent.push(String(init?.body));
		return new Response(JSON.stringify(body), { status });
	}) as typeof fetch;
	const source = new AnalyticsEngineSource({
		apiToken: 't',
		accountId: 'a',
		dataset: 'jrdan_link_clicks',
		fetch: fakeFetch,
	});
	return { source, sent };
}

describe('AnalyticsEngineSource', () => {
	test('filters and orders by the raw timestamp column', async () => {
		const { source, sent } = sourceAnswering({ data: [] });
		await source.since(new Date('2026-10-27T17:00:00Z'), 100);
		expect(sent[0]).toContain("WHERE timestamp >= toDateTime('2026-10-27 17:00:00')");
		expect(sent[0]).toContain('ORDER BY timestamp');
		expect(sent[0]).not.toMatch(/timestamp AS/);
	});

	test('reads rows into clicks with their sample weight', async () => {
		const { source } = sourceAnswering({
			data: [
				{
					id: 'f379',
					timestamp: '2026-10-27 17:01:28',
					slug: 'xEMkE',
					country: 'BR',
					region_code: 'MG',
					region: 'Minas Gerais',
					city: 'Rio Pomba',
					referrer: 'linkedin.com',
					device: 'desktop',
					latitude: -21.27,
					longitude: -43.18,
					weight: '10',
				},
			],
		});
		const [click] = await source.since(new Date(0), 100);
		expect(click).toMatchObject({
			id: 'f379',
			slug: 'xEMkE',
			regionCode: 'MG',
			city: 'Rio Pomba',
			latitude: -21.27,
			weight: 10,
		});
		expect(click?.at.toISOString()).toBe('2026-10-27T17:01:28.000Z');
	});

	test('surfaces api errors', async () => {
		const { source } = sourceAnswering({ error: 'nope' }, 422);
		expect(source.since(new Date(0), 100)).rejects.toThrow('422');
	});

	test('refuses dataset names that are not plain identifiers', () => {
		expect(() => new AnalyticsEngineSource({ apiToken: 't', accountId: 'a', dataset: 'jrdan.link' })).toThrow();
	});
});
