import { type Edge, EdgeError, type EdgeLink } from './edge';

interface CloudflareOptions {
	apiToken: string;
	accountId: string;
	namespaceId: string;
	zoneId: string;
	shortBaseUrl: string;
	fetch?: typeof fetch;
}

interface KvKey {
	name: string;
	expiration?: number;
	metadata?: { url?: string; createdAt?: string; expiresAt?: string | null };
}

interface CloudflareEnvelope<T> {
	success: boolean;
	errors: { message: string }[];
	result: T;
	result_info?: { cursor?: string };
}

const API = 'https://api.cloudflare.com/client/v4';

export class CloudflareEdge implements Edge {
	private readonly fetch: typeof fetch;

	constructor(private readonly options: CloudflareOptions) {
		this.fetch = options.fetch ?? fetch;
	}

	async put(link: EdgeLink): Promise<void> {
		const form = new FormData();
		form.set('value', link.url);
		form.set(
			'metadata',
			JSON.stringify({
				url: link.url,
				createdAt: link.createdAt.toISOString(),
				expiresAt: link.expiresAt?.toISOString() ?? null,
			}),
		);

		const query = link.expiresAt ? `?expiration=${Math.floor(link.expiresAt.getTime() / 1000)}` : '';
		await this.call(`${this.valuesPath(link.slug)}${query}`, { method: 'PUT', body: form });
		await this.purge(link.slug);
	}

	async remove(slug: string): Promise<void> {
		await this.call(this.valuesPath(slug), { method: 'DELETE' });
		await this.purge(slug);
	}

	async list(): Promise<EdgeLink[]> {
		const links: EdgeLink[] = [];
		let cursor: string | undefined;

		do {
			const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
			const page = await this.call<KvKey[]>(`${this.namespacePath()}/keys${query}`, { method: 'GET' });

			for (const key of page.result) {
				const url = key.metadata?.url ?? (await this.read(key.name));
				if (!url) continue;
				links.push({
					slug: key.name,
					url,
					createdAt: key.metadata?.createdAt ? new Date(key.metadata.createdAt) : new Date(),
					expiresAt: key.expiration ? new Date(key.expiration * 1000) : null,
				});
			}

			cursor = page.result_info?.cursor || undefined;
		} while (cursor);

		return links;
	}

	private async read(slug: string): Promise<string | null> {
		const response = await this.fetch(`${API}${this.valuesPath(slug)}`, {
			headers: { Authorization: `Bearer ${this.options.apiToken}` },
		});
		return response.ok ? response.text() : null;
	}

	private async purge(slug: string): Promise<void> {
		await this.call(`/zones/${this.options.zoneId}/purge_cache`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ files: [`${this.options.shortBaseUrl}/${slug}`] }),
		});
	}

	private namespacePath(): string {
		return `/accounts/${this.options.accountId}/storage/kv/namespaces/${this.options.namespaceId}`;
	}

	private valuesPath(slug: string): string {
		return `${this.namespacePath()}/values/${encodeURIComponent(slug)}`;
	}

	private async call<T = unknown>(path: string, init: RequestInit): Promise<CloudflareEnvelope<T>> {
		const response = await this.fetch(`${API}${path}`, {
			...init,
			headers: { ...init.headers, Authorization: `Bearer ${this.options.apiToken}` },
		});

		const body = (await response.json().catch(() => null)) as CloudflareEnvelope<T> | null;
		if (!response.ok || !body?.success) {
			const reason = body?.errors?.map((e) => e.message).join('; ') || response.statusText;
			throw new EdgeError(`Cloudflare ${init.method} ${path} failed: ${reason}`);
		}
		return body;
	}
}
