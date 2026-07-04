interface Env {
  LINKS: KVNamespace;
  DB: D1Database;
}

const BROWSER_TTL_SECONDS = 60;
const EDGE_TTL_SECONDS = 2_592_000;

function recordClick(env: Env, ctx: ExecutionContext, id: string, request: Request): void {
  const cf = request.cf;
  ctx.waitUntil(
    env.DB.prepare(
      'INSERT INTO clicks (link_id, country, city, region, referer, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        id,
        (cf?.country as string) ?? null,
        (cf?.city as string) ?? null,
        (cf?.region as string) ?? null,
        request.headers.get('referer'),
        request.headers.get('user-agent'),
      )
      .run(),
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = url.pathname.slice(1);
    if (!id) return new Response('Not found', { status: 404 });

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/${id}`);

    const cached = await cache.match(cacheKey);
    if (cached) {
      recordClick(env, ctx, id, request);
      return cached;
    }

    const destination = await env.LINKS.get(id, 'text');
    if (!destination) return new Response('Not found', { status: 404 });

    recordClick(env, ctx, id, request);

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
