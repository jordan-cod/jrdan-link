export interface EdgeLink {
	slug: string;
	url: string;
	createdAt: Date;
	expiresAt: Date | null;
}

export interface Edge {
	put(link: EdgeLink): Promise<void>;
	remove(slug: string): Promise<void>;
	list(): Promise<EdgeLink[]>;
}

export class EdgeError extends Error {}
