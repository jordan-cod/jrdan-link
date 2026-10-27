import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { clicksLabel, formatNumber, LINE_STROKE } from '../stats/scale';

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 24, left: 36 };

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabel = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00Z`)).replace('.', '');

function niceMax(value: number): number {
	if (value <= 4) return 4;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value) ?? 10;
	return step * magnitude * 4;
}

export function DailyChart({ series }: { series: { date: string; clicks: number }[] }) {
	const box = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(640);
	const [active, setActive] = useState<number | null>(null);

	useEffect(() => {
		const element = box.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const max = niceMax(Math.max(0, ...series.map((point) => point.clicks)));
	const plotWidth = Math.max(1, width - PAD.left - PAD.right);
	const plotHeight = HEIGHT - PAD.top - PAD.bottom;
	const x = (i: number) => PAD.left + (series.length <= 1 ? plotWidth / 2 : (i / (series.length - 1)) * plotWidth);
	const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

	const line = series
		.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.clicks).toFixed(1)}`)
		.join('');
	const ticks = [0, max / 2, max];
	const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])].filter((i) => i >= 0);

	function track(event: PointerEvent<SVGRectElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientX - rect.left) / rect.width;
		setActive(Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))));
	}

	const point = active !== null ? series[active] : undefined;

	return (
		<div ref={box} className="relative">
			<svg width={width} height={HEIGHT} className="block" role="img" aria-label="Cliques por dia">
				{ticks.map((tick) => (
					<g key={tick}>
						<line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e6e8eb" />
						<text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#686d75">
							{formatNumber(tick)}
						</text>
					</g>
				))}
				{labelIndexes.map((i) => {
					const day = series[i];
					return day ? (
						<text
							key={day.date}
							x={x(i)}
							y={HEIGHT - 6}
							textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
							fontSize={11}
							fill="#686d75"
						>
							{dayLabel(day.date)}
						</text>
					) : null;
				})}
				<path d={line} fill="none" stroke={LINE_STROKE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
				{point && active !== null && (
					<g pointerEvents="none">
						<line
							x1={x(active)}
							x2={x(active)}
							y1={PAD.top}
							y2={PAD.top + plotHeight}
							stroke="#15171a"
							strokeOpacity={0.25}
						/>
						<circle cx={x(active)} cy={y(point.clicks)} r={4.5} fill={LINE_STROKE} stroke="#ffffff" strokeWidth={2} />
					</g>
				)}
				<rect
					x={PAD.left}
					y={PAD.top}
					width={plotWidth}
					height={plotHeight}
					fill="transparent"
					onPointerMove={track}
					onPointerLeave={() => setActive(null)}
				/>
			</svg>
			{point && active !== null && (
				<div
					className="pointer-events-none absolute top-0 rounded-md border border-rule bg-surface px-2.5 py-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.08)]"
					style={{
						left: x(active),
						transform: `translateX(${x(active) > width / 2 ? 'calc(-100% - 10px)' : '10px'})`,
					}}
				>
					<p className="text-sm font-semibold tabular-nums">{clicksLabel(point.clicks)}</p>
					<p className="text-xs text-mute">{dayLabel(point.date)}</p>
				</div>
			)}
		</div>
	);
}
