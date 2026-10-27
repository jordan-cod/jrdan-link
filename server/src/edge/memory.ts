import { type Edge, EdgeError, type EdgeLink } from './edge';

export class MemoryEdge implements Edge {
	readonly links = new Map<string, EdgeLink>();
	failNext = false;

	async put(link: EdgeLink): Promise<void> {
		this.maybeFail();
		this.links.set(link.slug, link);
	}

	async remove(slug: string): Promise<void> {
		this.maybeFail();
		this.links.delete(slug);
	}

	async list(): Promise<EdgeLink[]> {
		return [...this.links.values()];
	}

	private maybeFail(): void {
		if (!this.failNext) return;
		this.failNext = false;
		throw new EdgeError('edge unavailable');
	}
}
