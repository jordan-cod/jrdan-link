import type { ClickSource } from './click';
import type { ClickRepository } from './repository';

const PAGE = 5000;
const OVERLAP_MS = 10 * 60 * 1000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class ClickSync {
	private running: Promise<number> | null = null;
	lastSyncedAt: Date | null = null;

	constructor(
		private readonly source: ClickSource,
		private readonly clicks: ClickRepository,
		private readonly now: () => Date = () => new Date(),
	) {}

	run(): Promise<number> {
		this.running ??= this.pull().finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async pull(): Promise<number> {
		const cursor = this.clicks.cursor();
		let from = cursor ? new Date(cursor.getTime() - OVERLAP_MS) : new Date(this.now().getTime() - RETENTION_MS);
		let inserted = 0;
		let latest = cursor;

		for (;;) {
			const page = await this.source.since(from, PAGE);
			inserted += this.clicks.insert(page);

			const last = page.at(-1)?.at;
			if (last && (!latest || last > latest)) latest = last;
			if (page.length < PAGE || !last || last.getTime() === from.getTime()) break;
			from = last;
		}

		if (latest) this.clicks.saveCursor(latest);
		this.lastSyncedAt = this.now();
		return inserted;
	}
}
