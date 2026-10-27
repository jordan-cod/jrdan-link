import { createApp } from './app';
import { GitHubClient } from './auth/github';
import { SessionStore } from './auth/sessions';
import { TokenStore } from './auth/tokens';
import { loadConfig } from './config';
import { openDatabase } from './db/database';
import { CloudflareEdge } from './edge/cloudflare';
import { LinkRepository } from './links/repository';
import { LinkService } from './links/service';

const HOUR_MS = 60 * 60 * 1000;

const config = loadConfig();
const db = openDatabase(config.databasePath);

const edge = new CloudflareEdge({ ...config.cloudflare, shortBaseUrl: config.shortBaseUrl });
const links = new LinkService(new LinkRepository(db), edge, config.shortBaseUrl);
const sessions = new SessionStore(db);

const app = createApp({
	publicUrl: config.publicUrl,
	allowedLogin: config.github.allowedLogin,
	webDist: config.webDist,
	links,
	sessions,
	tokens: new TokenStore(db),
	github: new GitHubClient({
		clientId: config.github.clientId,
		clientSecret: config.github.clientSecret,
		redirectUri: `${config.publicUrl}/auth/github/callback`,
	}),
});

setInterval(() => {
	links.pruneExpired();
	sessions.pruneExpired();
}, HOUR_MS);

app.listen({ port: config.port, hostname: '0.0.0.0' });
console.log(`jrdan-link listening on :${config.port}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		app.stop();
		db.close();
		process.exit(0);
	});
}
