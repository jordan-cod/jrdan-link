import { clickPoint } from './click';
import type { LinkMetadata, RedirectEnv } from './env';

const BROWSER_TTL_SECONDS = 60;
const EDGE_TTL_SECONDS = 2_592_000;

const notFound = () => new Response('Not found', { status: 404 });

function edgeTtl(metadata: LinkMetadata | null, now: number): number {
	if (!metadata?.expiresAt) return EDGE_TTL_SECONDS;
	const remaining = Math.floor((Date.parse(metadata.expiresAt) - now) / 1000);
	return Math.max(0, Math.min(EDGE_TTL_SECONDS, remaining));
}

function record(env: RedirectEnv, request: Request, slug: string): void {
	try {
		env.CLICKS?.writeDataPoint(clickPoint(request, slug));
	} catch {}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const slug = url.pathname.slice(1);
		if (!slug) return notFound();

		const cache = caches.default;
		const cacheKey = new Request(`${url.origin}/${slug}`);

		const cached = await cache.match(cacheKey);
		if (cached) {
			record(env, request, slug);
			return cached;
		}

		const { value: destination, metadata } = await env.LINKS.getWithMetadata<LinkMetadata>(slug, 'text');
		if (!destination) return notFound();

		record(env, request, slug);

		const ttl = edgeTtl(metadata, Date.now());
		const response = new Response(null, {
			status: 302,
			headers: {
				Location: destination,
				'Cache-Control':
					ttl > 0 ? `public, max-age=${Math.min(BROWSER_TTL_SECONDS, ttl)}, s-maxage=${ttl}` : 'no-store',
			},
		});

		if (ttl > 0) ctx.waitUntil(cache.put(cacheKey, response.clone()));
		return response;
	},
} satisfies ExportedHandler<RedirectEnv>;
