interface Env {
  LINKS: KVNamespace;
}

const BROWSER_TTL_SECONDS = 60;
const EDGE_TTL_SECONDS = 2_592_000;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = url.pathname.slice(1);
    if (!id) return new Response('Not found', { status: 404 });

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/${id}`);

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const destination = await env.LINKS.get(id, 'text');
    if (!destination) return new Response('Not found', { status: 404 });

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        'Cache-Control': `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
} satisfies ExportedHandler<Env>;
