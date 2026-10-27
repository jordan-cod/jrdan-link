import { BAR_FILL, formatNumber } from '../stats/scale';

export interface BarItem {
	key: string;
	label: string;
	clicks: number;
	onSelect?: () => void;
}

interface BarListProps {
	items: BarItem[];
	empty?: string;
	hovered?: string | null;
	onHover?: (key: string | null) => void;
	ranked?: boolean;
	limit?: number;
}

export function BarList({
	items,
	empty = 'Nenhum clique ainda.',
	hovered = null,
	onHover,
	ranked = false,
	limit,
}: BarListProps) {
	if (items.length === 0) return <p className="py-6 text-center text-sm text-mute">{empty}</p>;
	const max = Math.max(1, ...items.map((item) => item.clicks));
	const visible = limit ? items.slice(0, limit) : items;

	return (
		<ul className="grid">
			{visible.map((item, index) => {
				const lit = hovered === item.key;
				const content = (
					<>
						<span className="flex items-baseline gap-2.5">
							{ranked && <span className="w-4 shrink-0 text-right text-xs text-mute tabular-nums">{index + 1}</span>}
							<span className="min-w-0 flex-1 truncate">{item.label}</span>
							<span className="font-semibold tabular-nums">{formatNumber(item.clicks)}</span>
						</span>
						<span className={`mt-1.5 block h-1.5 overflow-hidden rounded-full bg-wash ${ranked ? 'ml-6.5' : ''}`}>
							<span
								className="block h-full rounded-full transition-[width,opacity] duration-300"
								style={{
									width: `${Math.max(2, (item.clicks / max) * 100)}%`,
									background: BAR_FILL,
									opacity: lit ? 1 : 0.8,
								}}
							/>
						</span>
					</>
				);
				const className = `block w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${lit ? 'bg-wash' : ''}`;
				const hover = {
					onPointerEnter: () => onHover?.(item.key),
					onPointerLeave: () => onHover?.(null),
				};
				return (
					<li key={item.key}>
						{item.onSelect ? (
							<button
								type="button"
								onClick={item.onSelect}
								className={`${className} hover:bg-wash`}
								onFocus={() => onHover?.(item.key)}
								onBlur={() => onHover?.(null)}
								{...hover}
							>
								{content}
							</button>
						) : (
							<div className={className} {...hover}>
								{content}
							</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}
