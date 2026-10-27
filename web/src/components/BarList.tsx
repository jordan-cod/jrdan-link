import { BAR_FILL, formatNumber } from '../stats/scale';

export interface BarItem {
	key: string;
	label: string;
	clicks: number;
	onSelect?: () => void;
	active?: boolean;
}

export function BarList({ items, empty = 'Nenhum clique ainda.' }: { items: BarItem[]; empty?: string }) {
	if (items.length === 0) return <p className="text-sm text-mute">{empty}</p>;
	const max = Math.max(1, ...items.map((item) => item.clicks));

	return (
		<ul className="grid gap-1">
			{items.map((item) => {
				const content = (
					<>
						<span
							aria-hidden="true"
							className="absolute inset-y-0.5 left-0 rounded-[4px] opacity-20 transition-[width] duration-300"
							style={{ width: `${(item.clicks / max) * 100}%`, background: BAR_FILL }}
						/>
						<span className="relative min-w-0 truncate">{item.label}</span>
						<span className="relative font-medium tabular-nums">{formatNumber(item.clicks)}</span>
					</>
				);
				const className = `relative flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm ${
					item.active ? 'ring-1 ring-ink/30' : ''
				}`;
				return (
					<li key={item.key}>
						{item.onSelect ? (
							<button type="button" onClick={item.onSelect} className={`${className} hover:bg-wash/70`}>
								{content}
							</button>
						) : (
							<div className={className}>{content}</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}
