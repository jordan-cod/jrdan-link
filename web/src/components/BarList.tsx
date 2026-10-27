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
}

export function BarList({ items, empty = 'Nenhum clique ainda.', hovered = null, onHover }: BarListProps) {
	if (items.length === 0) return <p className="py-2 text-sm text-mute">{empty}</p>;
	const max = Math.max(1, ...items.map((item) => item.clicks));

	return (
		<ul className="grid gap-0.5">
			{items.map((item) => {
				const lit = hovered === item.key;
				const content = (
					<>
						<span
							aria-hidden="true"
							className="absolute inset-y-1 left-0 rounded-[4px] transition-[width,opacity] duration-300"
							style={{ width: `${(item.clicks / max) * 100}%`, background: BAR_FILL, opacity: lit ? 0.34 : 0.18 }}
						/>
						<span className="relative min-w-0 truncate">{item.label}</span>
						<span className="relative font-medium tabular-nums">{formatNumber(item.clicks)}</span>
					</>
				);
				const className =
					'relative flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm';
				const hover = {
					onPointerEnter: () => onHover?.(item.key),
					onPointerLeave: () => onHover?.(null),
					onFocus: () => onHover?.(item.key),
					onBlur: () => onHover?.(null),
				};
				return (
					<li key={item.key}>
						{item.onSelect ? (
							<button type="button" onClick={item.onSelect} className={className} {...hover}>
								{content}
							</button>
						) : (
							<div className={className} onPointerEnter={hover.onPointerEnter} onPointerLeave={hover.onPointerLeave}>
								{content}
							</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}
