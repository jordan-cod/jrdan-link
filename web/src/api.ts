export interface Link {
	slug: string;
	clicks: number;
	url: string;
	shortUrl: string;
	createdAt: string;
	updatedAt: string;
	expiresAt: string | null;
}

export interface ApiToken {
	id: string;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
}

export interface LinkInput {
	url: string;
	slug?: string | null;
	expiresAt?: string | null;
}

export type Range = '7d' | '30d' | '90d' | 'all';

export interface StatsQuery {
	range: Range;
	slug?: string;
}

export interface Overview {
	total: number;
	previousTotal: number | null;
	cities: number;
	bots: number;
	syncedAt: string | null;
	series: { date: string; clicks: number }[];
	countries: { code: string; clicks: number }[];
	links: { slug: string; clicks: number }[];
	referrers: { host: string; clicks: number }[];
	devices: { device: string; clicks: number }[];
}

export interface CountryDetail {
	country: string;
	total: number;
	regions: { code: string; name: string; clicks: number }[];
	cities: {
		name: string;
		regionCode: string;
		region: string;
		latitude: number | null;
		longitude: number | null;
		clicks: number;
	}[];
}

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		...init,
		headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
	});

	if (response.status === 204) return undefined as T;

	const body = (await response.json().catch(() => null)) as { error?: string } | null;
	if (!response.ok) {
		throw new ApiError(response.status, body?.error ?? 'Algo deu errado. Tente de novo.');
	}
	return body as T;
}

function statsParams(query: StatsQuery): string {
	const params = new URLSearchParams({ range: query.range, offset: String(-new Date().getTimezoneOffset()) });
	if (query.slug) params.set('slug', query.slug);
	return params.toString();
}

export const api = {
	me: () => request<{ login: string }>('/api/me'),
	logout: () => request<void>('/auth/logout', { method: 'POST' }),
	links: () => request<{ links: Link[] }>('/api/links').then((r) => r.links),
	createLink: (input: LinkInput) => request<Link>('/api/links', { method: 'POST', body: JSON.stringify(input) }),
	updateLink: (slug: string, input: LinkInput) =>
		request<Link>(`/api/links/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(input) }),
	deleteLink: (slug: string) => request<void>(`/api/links/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
	tokens: () => request<{ tokens: ApiToken[] }>('/api/tokens').then((r) => r.tokens),
	createToken: (name: string) =>
		request<{ token: ApiToken; secret: string }>('/api/tokens', { method: 'POST', body: JSON.stringify({ name }) }),
	stats: (query: StatsQuery) => request<Overview>(`/api/stats?${statsParams(query)}`),
	country: (code: string, query: StatsQuery) =>
		request<CountryDetail>(`/api/stats/countries/${encodeURIComponent(code)}?${statsParams(query)}`),
	revokeToken: (id: string) => request<void>(`/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
