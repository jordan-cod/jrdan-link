import type { Click, ClickSource } from './click';

export class MemoryClickSource implements ClickSource {
	readonly clicks: Click[] = [];

	async since(from: Date, limit: number): Promise<Click[]> {
		return this.clicks
			.filter((click) => click.at >= from)
			.sort((a, b) => a.at.getTime() - b.at.getTime())
			.slice(0, limit);
	}
}
