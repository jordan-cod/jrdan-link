export interface GitHubOAuth {
	authorizeUrl(state: string): string;
	login(code: string): Promise<string | null>;
}

interface GitHubOptions {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	fetch?: typeof fetch;
}

export class GitHubClient implements GitHubOAuth {
	private readonly fetch: typeof fetch;

	constructor(private readonly options: GitHubOptions) {
		this.fetch = options.fetch ?? fetch;
	}

	authorizeUrl(state: string): string {
		const params = new URLSearchParams({
			client_id: this.options.clientId,
			redirect_uri: this.options.redirectUri,
			scope: 'read:user',
			state,
			allow_signup: 'false',
		});
		return `https://github.com/login/oauth/authorize?${params}`;
	}

	async login(code: string): Promise<string | null> {
		const exchange = await this.fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_id: this.options.clientId,
				client_secret: this.options.clientSecret,
				code,
				redirect_uri: this.options.redirectUri,
			}),
		});
		const grant = (await exchange.json().catch(() => null)) as { access_token?: string } | null;
		if (!grant?.access_token) return null;

		const user = await this.fetch('https://api.github.com/user', {
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${grant.access_token}`,
				'User-Agent': 'jrdan-link',
			},
		});
		if (!user.ok) return null;

		const profile = (await user.json()) as { login?: string };
		return profile.login ?? null;
	}
}
