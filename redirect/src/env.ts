export interface LinkMetadata {
	url: string;
	createdAt: string;
	expiresAt?: string | null;
}

export interface RedirectEnv {
	LINKS: KVNamespace;
}
