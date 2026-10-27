export interface Config {
	port: number;
	publicUrl: string;
	shortBaseUrl: string;
	databasePath: string;
	webDist: string;
	github: {
		clientId: string;
		clientSecret: string;
		allowedLogin: string;
	};
	cloudflare: {
		apiToken: string;
		accountId: string;
		namespaceId: string;
		zoneId: string;
		clicksDataset: string;
	};
}

function required(env: Record<string, string | undefined>, name: string): string {
	const value = env[name];
	if (!value) throw new Error(`Missing environment variable ${name}`);
	return value;
}

const trimSlash = (value: string) => value.replace(/\/+$/, '');

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	return {
		port: Number(env.PORT ?? 3000),
		publicUrl: trimSlash(required(env, 'PUBLIC_URL')),
		shortBaseUrl: trimSlash(required(env, 'SHORT_BASE_URL')),
		databasePath: env.DATABASE_PATH ?? 'data/jrdan-link.db',
		webDist: env.WEB_DIST ?? '../web/dist',
		github: {
			clientId: required(env, 'GITHUB_CLIENT_ID'),
			clientSecret: required(env, 'GITHUB_CLIENT_SECRET'),
			allowedLogin: required(env, 'GITHUB_ALLOWED_LOGIN').toLowerCase(),
		},
		cloudflare: {
			apiToken: required(env, 'CLOUDFLARE_API_TOKEN'),
			accountId: required(env, 'CLOUDFLARE_ACCOUNT_ID'),
			namespaceId: required(env, 'CLOUDFLARE_KV_NAMESPACE_ID'),
			zoneId: required(env, 'CLOUDFLARE_ZONE_ID'),
			clicksDataset: env.CLICKS_DATASET ?? 'jrdan_link_clicks',
		},
	};
}
