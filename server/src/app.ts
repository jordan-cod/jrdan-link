import { resolve as resolvePath, sep } from 'node:path';
import { Elysia, t } from 'elysia';
import type { GitHubOAuth } from './auth/github';
import { randomToken } from './auth/secrets';
import { SESSION_TTL_MS, type SessionStore } from './auth/sessions';
import type { ApiToken, TokenStore } from './auth/tokens';
import type { ClickRepository } from './clicks/repository';
import { country, filterFor, overview, RANGES, type Range } from './clicks/stats';
import type { ClickSync } from './clicks/sync';
import type { Link } from './links/repository';
import type { LinkResult, LinkService } from './links/service';

export interface AppDeps {
	publicUrl: string;
	allowedLogin: string;
	webDist: string;
	links: LinkService;
	sessions: SessionStore;
	tokens: TokenStore;
	github: GitHubOAuth;
	clicks: ClickRepository;
	sync: ClickSync;
}

type Principal = { kind: 'session' | 'token'; login: string };

const STATE_TTL_SECONDS = 600;

const statsQuery = t.Object({
	range: t.Optional(t.Union(Object.keys(RANGES).map((key) => t.Literal(key)))),
	slug: t.Optional(t.String({ maxLength: 64 })),
	offset: t.Optional(t.Numeric({ minimum: -840, maximum: 840 })),
});

const linkBody = t.Object({
	url: t.String({ maxLength: 4096 }),
	slug: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
	expiresAt: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
});

export function createApp(deps: AppDeps) {
	const secure = deps.publicUrl.startsWith('https://');
	const cookieOptions = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
	const publicOrigin = new URL(deps.publicUrl).origin;
	const webRoot = resolvePath(deps.webDist);

	const presentLink = (link: Link, clicks = 0) => ({
		slug: link.slug,
		clicks,
		url: link.url,
		shortUrl: deps.links.shortUrl(link.slug),
		createdAt: link.createdAt.toISOString(),
		updatedAt: link.updatedAt.toISOString(),
		expiresAt: link.expiresAt?.toISOString() ?? null,
	});

	const presentToken = (token: ApiToken) => ({
		id: token.id,
		name: token.name,
		createdAt: token.createdAt.toISOString(),
		lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
	});

	const authenticate = (request: Request, sessionToken: unknown): Principal | null => {
		const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
		if (bearer) return deps.tokens.verify(bearer) ? { kind: 'token', login: deps.allowedLogin } : null;
		if (typeof sessionToken !== 'string' || !sessionToken) return null;
		const login = deps.sessions.login(sessionToken);
		return login ? { kind: 'session', login } : null;
	};

	const sameOrigin = (request: Request) => request.headers.get('origin') === publicOrigin;

	const api = new Elysia({ prefix: '/api' })
		.resolve(({ request, cookie }) => ({ principal: authenticate(request, cookie.session?.value) }))
		.onBeforeHandle(({ principal, request, set }) => {
			if (!principal) {
				set.status = 401;
				return { error: 'Faça login pra continuar' };
			}
			if (principal.kind === 'session' && request.method !== 'GET' && !sameOrigin(request)) {
				set.status = 403;
				return { error: 'Origem não permitida' };
			}
		})
		.get('/me', ({ principal }) => ({ login: principal?.login }))
		.get('/links', () => {
			const totals = deps.clicks.totalsBySlug();
			return { links: deps.links.list().map((link) => presentLink(link, totals.get(link.slug) ?? 0)) };
		})
		.get(
			'/stats',
			({ query }) => {
				const filter = filterFor((query.range ?? '30d') as Range, query.slug || null, query.offset ?? 0);
				return { ...overview(deps.clicks, filter), syncedAt: deps.sync.lastSyncedAt?.toISOString() ?? null };
			},
			{ query: statsQuery },
		)
		.get(
			'/stats/countries/:code',
			({ params, query }) => {
				const filter = filterFor((query.range ?? '30d') as Range, query.slug || null, query.offset ?? 0);
				return country(deps.clicks, filter, params.code.toUpperCase());
			},
			{ query: statsQuery },
		)
		.post('/links', async ({ body, set }) => respond(await deps.links.create(body), set, 201), { body: linkBody })
		.patch(
			'/links/:slug',
			async ({ params, body, set }) => respond(await deps.links.update(params.slug, body), set, 200),
			{ body: linkBody },
		)
		.delete('/links/:slug', async ({ params, set }) => {
			const result = await deps.links.remove(params.slug);
			if (!result.ok) return fail(result, set);
			set.status = 204;
			return null;
		})
		.get('/tokens', ({ principal, set }) => {
			if (!isSession(principal)) return denyToken(set);
			return { tokens: deps.tokens.list().map(presentToken) };
		})
		.post(
			'/tokens',
			({ principal, body, set }) => {
				if (!isSession(principal)) return denyToken(set);
				const { token, secret } = deps.tokens.create(body.name.trim() || 'Sem nome');
				set.status = 201;
				return { token: presentToken(token), secret };
			},
			{ body: t.Object({ name: t.String({ maxLength: 80 }) }) },
		)
		.delete('/tokens/:id', ({ principal, params, set }) => {
			if (!isSession(principal)) return denyToken(set);
			if (!deps.tokens.revoke(params.id)) {
				set.status = 404;
				return { error: 'Token não encontrado' };
			}
			set.status = 204;
			return null;
		});

	function isSession(principal: Principal | null): boolean {
		return principal?.kind === 'session';
	}

	function denyToken(set: { status?: number | string }) {
		set.status = 403;
		return { error: 'Tokens só podem ser geridos pelo painel' };
	}

	function respond(result: LinkResult, set: { status?: number | string }, okStatus: number) {
		if (!result.ok) return fail(result, set);
		set.status = okStatus;
		return presentLink(result.link);
	}

	function fail(result: Extract<LinkResult, { ok: false }>, set: { status?: number | string }) {
		set.status = result.status;
		return { error: result.error };
	}

	return new Elysia()
		.onError(({ code, set }) => {
			if (code === 'VALIDATION') {
				set.status = 400;
				return { error: 'Dados inválidos' };
			}
			if (code === 'NOT_FOUND') return;
			set.status = 500;
			return { error: 'Erro interno' };
		})
		.get('/health', () => 'ok')
		.get('/auth/github', ({ cookie, redirect }) => {
			const state = randomToken(16);
			cookie.oauth_state?.set({ ...cookieOptions, value: state, maxAge: STATE_TTL_SECONDS });
			return redirect(deps.github.authorizeUrl(state), 302);
		})
		.get(
			'/auth/github/callback',
			async ({ query, cookie, redirect }) => {
				const expected = cookie.oauth_state?.value;
				cookie.oauth_state?.remove();

				if (!query.code || !query.state || typeof expected !== 'string' || query.state !== expected) {
					return redirect('/login?error=state', 302);
				}

				const login = await deps.github.login(query.code);
				if (!login) return redirect('/login?error=github', 302);
				if (login.toLowerCase() !== deps.allowedLogin) return redirect('/login?error=denied', 302);

				const session = deps.sessions.create(login);
				cookie.session?.set({ ...cookieOptions, value: session.token, maxAge: SESSION_TTL_MS / 1000 });
				return redirect('/', 302);
			},
			{ query: t.Object({ code: t.Optional(t.String()), state: t.Optional(t.String()) }) },
		)
		.post('/auth/logout', ({ cookie, request, set }) => {
			if (!sameOrigin(request)) {
				set.status = 403;
				return { error: 'Origem não permitida' };
			}
			const token = cookie.session?.value;
			if (typeof token === 'string' && token) deps.sessions.revoke(token);
			cookie.session?.remove();
			set.status = 204;
			return null;
		})
		.use(api)
		.get('/*', async ({ params, set }) => {
			if (params['*']?.startsWith('api/')) {
				set.status = 404;
				return { error: 'Rota não encontrada' };
			}
			const requested = resolvePath(webRoot, `.${sep}${params['*'] ?? ''}`);
			if (requested.startsWith(`${webRoot}${sep}`)) {
				const file = Bun.file(requested);
				if (await file.exists()) {
					if (requested.includes(`${sep}assets${sep}`)) {
						set.headers['cache-control'] = 'public, max-age=31536000, immutable';
					}
					return file;
				}
			}
			set.headers['cache-control'] = 'no-cache';
			set.headers['content-type'] = 'text/html; charset=utf-8';
			return Bun.file(resolvePath(webRoot, 'index.html'));
		});
}
