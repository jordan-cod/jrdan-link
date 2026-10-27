import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app';
import type { GitHubOAuth } from './auth/github';
import { SessionStore } from './auth/sessions';
import { TokenStore } from './auth/tokens';
import { openDatabase } from './db/database';
import { MemoryEdge } from './edge/memory';
import { LinkRepository } from './links/repository';
import { LinkService } from './links/service';

const PUBLIC_URL = 'https://shortener.example.dev';
const SHORT = 'https://jrd.example';

const webDist = mkdtempSync(join(tmpdir(), 'jrdan-link-web-'));
writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>panel</title>');
afterAll(() => rmSync(webDist, { recursive: true, force: true }));

function setup(login: string | null = 'jordan-cod') {
	const db = openDatabase(':memory:');
	const edge = new MemoryEdge();
	const sessions = new SessionStore(db);
	const tokens = new TokenStore(db);
	const github: GitHubOAuth = {
		authorizeUrl: (state) => `https://github.test/authorize?state=${state}`,
		login: async () => login,
	};
	const app = createApp({
		publicUrl: PUBLIC_URL,
		allowedLogin: 'jordan-cod',
		webDist,
		links: new LinkService(new LinkRepository(db), edge, SHORT),
		sessions,
		tokens,
		github,
	});
	const secret = tokens.create('tests').secret;
	const session = sessions.create('jordan-cod').token;

	const call = (path: string, init: RequestInit & { json?: unknown } = {}) => {
		const headers = new Headers(init.headers);
		if (init.json !== undefined) headers.set('content-type', 'application/json');
		return app.handle(
			new Request(`${PUBLIC_URL}${path}`, {
				...init,
				headers,
				body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
			}),
		);
	};

	const withToken = { authorization: `Bearer ${secret}` };
	const withSession = { cookie: `session=${session}`, origin: PUBLIC_URL };

	return { app, db, edge, tokens, call, withToken, withSession };
}

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
	ctx = setup();
});

describe('auth', () => {
	test('rejects requests without credentials', async () => {
		const response = await ctx.call('/api/links');
		expect(response.status).toBe(401);
	});

	test('rejects an unknown token', async () => {
		const response = await ctx.call('/api/links', { headers: { authorization: 'Bearer jl_nope' } });
		expect(response.status).toBe(401);
	});

	test('accepts a session cookie', async () => {
		const response = await ctx.call('/api/me', { headers: ctx.withSession });
		expect(await response.json()).toEqual({ login: 'jordan-cod' });
	});

	test('blocks session writes from another origin', async () => {
		const response = await ctx.call('/api/links', {
			method: 'POST',
			headers: { ...ctx.withSession, origin: 'https://evil.example' },
			json: { url: 'https://example.com' },
		});
		expect(response.status).toBe(403);
	});

	test('keeps token management out of reach of API tokens', async () => {
		const response = await ctx.call('/api/tokens', { headers: ctx.withToken });
		expect(response.status).toBe(403);
	});
});

describe('links', () => {
	test('creates a link and publishes it to the edge', async () => {
		const response = await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://example.com/a', slug: 'cv' },
		});
		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toMatchObject({ slug: 'cv', url: 'https://example.com/a', shortUrl: `${SHORT}/cv` });
		expect(ctx.edge.links.get('cv')?.url).toBe('https://example.com/a');
	});

	test('generates a slug when none is given', async () => {
		const response = await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://example.com' },
		});
		const body = (await response.json()) as { slug: string };
		expect(body.slug).toMatch(/^[2-9a-zA-Z]{5}$/);
	});

	test('refuses a slug already in use', async () => {
		const create = () =>
			ctx.call('/api/links', { method: 'POST', headers: ctx.withToken, json: { url: 'https://a.com', slug: 'dup' } });
		await create();
		expect((await create()).status).toBe(409);
	});

	test('refuses invalid urls and links to the shortener itself', async () => {
		for (const url of ['ftp://example.com', 'not a url', `${SHORT}/loop`]) {
			const response = await ctx.call('/api/links', { method: 'POST', headers: ctx.withToken, json: { url } });
			expect(response.status).toBe(400);
		}
	});

	test('refuses an expiry in the past', async () => {
		const response = await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://example.com', expiresAt: '2000-01-01T00:00:00Z' },
		});
		expect(response.status).toBe(400);
	});

	test('rolls back a create when the edge fails', async () => {
		ctx.edge.failNext = true;
		const response = await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://example.com', slug: 'gone' },
		});
		expect(response.status).toBe(502);
		const list = await (await ctx.call('/api/links', { headers: ctx.withToken })).json();
		expect(list).toEqual({ links: [] });
	});

	test('updates the destination everywhere', async () => {
		await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://a.com', slug: 'go' },
		});
		const response = await ctx.call('/api/links/go', {
			method: 'PATCH',
			headers: ctx.withToken,
			json: { url: 'https://b.com' },
		});
		expect(response.status).toBe(200);
		expect(ctx.edge.links.get('go')?.url).toBe('https://b.com/');
	});

	test('keeps the old destination when the edge rejects an update', async () => {
		await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://a.com', slug: 'go' },
		});
		ctx.edge.failNext = true;
		const response = await ctx.call('/api/links/go', {
			method: 'PATCH',
			headers: ctx.withToken,
			json: { url: 'https://b.com' },
		});
		expect(response.status).toBe(502);
		const list = (await (await ctx.call('/api/links', { headers: ctx.withToken })).json()) as {
			links: { url: string }[];
		};
		expect(list.links[0]?.url).toBe('https://a.com/');
	});

	test('deletes a link from the edge and the database', async () => {
		await ctx.call('/api/links', {
			method: 'POST',
			headers: ctx.withToken,
			json: { url: 'https://a.com', slug: 'bye' },
		});
		const response = await ctx.call('/api/links/bye', { method: 'DELETE', headers: ctx.withToken });
		expect(response.status).toBe(204);
		expect(ctx.edge.links.has('bye')).toBe(false);
		expect((await ctx.call('/api/links/bye', { method: 'DELETE', headers: ctx.withToken })).status).toBe(404);
	});
});

describe('tokens', () => {
	test('creates, lists and revokes tokens from the panel', async () => {
		const created = await ctx.call('/api/tokens', {
			method: 'POST',
			headers: ctx.withSession,
			json: { name: 'Atalho do Mac' },
		});
		expect(created.status).toBe(201);
		const { token, secret } = (await created.json()) as { token: { id: string }; secret: string };
		expect(secret).toStartWith('jl_');

		const usable = await ctx.call('/api/links', { headers: { authorization: `Bearer ${secret}` } });
		expect(usable.status).toBe(200);

		const revoked = await ctx.call(`/api/tokens/${token.id}`, { method: 'DELETE', headers: ctx.withSession });
		expect(revoked.status).toBe(204);

		const rejected = await ctx.call('/api/links', { headers: { authorization: `Bearer ${secret}` } });
		expect(rejected.status).toBe(401);
	});
});

describe('github login', () => {
	const callback = (app: ReturnType<typeof setup>, state: string, cookieState: string) =>
		app.call(`/auth/github/callback?code=abc&state=${state}`, { headers: { cookie: `oauth_state=${cookieState}` } });

	test('starts the flow with a state cookie', async () => {
		const response = await ctx.call('/auth/github');
		expect(response.status).toBe(302);
		const state = new URL(response.headers.get('location') ?? '').searchParams.get('state');
		expect(response.headers.get('set-cookie')).toContain(`oauth_state=${state}`);
	});

	test('rejects a mismatched state', async () => {
		const response = await callback(ctx, 'one', 'two');
		expect(response.headers.get('location')).toBe('/login?error=state');
	});

	test('rejects any other GitHub account', async () => {
		const response = await callback(setup('someone-else'), 'same', 'same');
		expect(response.headers.get('location')).toBe('/login?error=denied');
	});

	test('signs the allowed account in', async () => {
		const response = await callback(ctx, 'same', 'same');
		expect(response.headers.get('location')).toBe('/');
		expect(response.headers.get('set-cookie')).toMatch(/session=[^;]+;.*HttpOnly/i);
	});
});

describe('panel', () => {
	test('serves the app shell for client routes', async () => {
		const response = await ctx.call('/tokens');
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('panel');
	});

	test('does not serve files outside the build', async () => {
		const response = await ctx.call('/..%2f..%2fetc%2fpasswd');
		expect(await response.text()).toContain('panel');
	});

	test('answers unknown api routes with json', async () => {
		const response = await ctx.call('/api/nope', { headers: ctx.withToken });
		expect(response.status).toBe(404);
	});
});
