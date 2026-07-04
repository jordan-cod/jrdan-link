interface Env {
  LINKS: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = new URL(request.url).pathname.slice(1);
    if (!id) return new Response('Not found', { status: 404 });

    const url = await env.LINKS.get(id, 'text');
    if (!url) return new Response('Not found', { status: 404 });

    return Response.redirect(url, 302);
  },
} satisfies ExportedHandler<Env>;
