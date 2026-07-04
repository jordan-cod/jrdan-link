interface Env {
  LINKS: KVNamespace;
}

const CACHE_TTL_SECONDS = 3600;

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
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
} satisfies ExportedHandler<Env>;
