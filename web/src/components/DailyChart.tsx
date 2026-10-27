import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { clicksLabel, formatNumber, RAMP } from '../stats/scale';

const HEIGHT = 220;
const PAD = { top: 16, right: 4, bottom: 26, left: 34 };
const GAP = 2;

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const dayLabel = (iso: string) => dayFormat.format(asDate(iso)).replace('.', '');

function niceMax(value: number): number {
	if (value <= 4) return 4;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value) ?? 10;
	return step * magnitude * 4;
}

function columnPath(x: number, y: number, width: number, height: number): string {
	if (height <= 0) return '';
	const r = Math.min(4, width / 2, height);
	return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
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
	const slot = plotWidth / Math.max(1, series.length);
	const barWidth = Math.max(2, Math.min(28, slot - GAP));
	const x = (i: number) => PAD.left + i * slot + (slot - barWidth) / 2;
	const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
	const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
	const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(plotWidth / 70))));

	function track(event: PointerEvent<SVGRectElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		const index = Math.floor(((event.clientX - rect.left) / rect.width) * series.length);
		setActive(Math.max(0, Math.min(series.length - 1, index)));
	}

	const point = active !== null ? series[active] : undefined;

	return (
		<div ref={box} className="relative">
			<svg width={width} height={HEIGHT} className="block" role="img" aria-label="Cliques por dia">
				{ticks.map((tick) => (
					<g key={tick}>
						<line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#eef1f5" />
						<text
							x={PAD.left - 10}
							y={y(tick)}
							textAnchor="end"
							dominantBaseline="central"
							fontSize={11}
							fill="#667085"
						>
							{formatNumber(tick)}
						</text>
					</g>
				))}
				{series.map((day, i) => (
					<path
						key={day.date}
						d={columnPath(x(i), y(day.clicks), barWidth, PAD.top + plotHeight - y(day.clicks))}
						fill={active === i ? RAMP[3] : RAMP[1]}
						className="transition-[fill] duration-100"
					/>
				))}
				{series.map((day, i) =>
					i % labelEvery === 0 ? (
						<text
							key={day.date}
							x={x(i) + barWidth / 2}
							y={HEIGHT - 6}
							textAnchor="middle"
							fontSize={11}
							fill="#667085"
						>
							{dayLabel(day.date)}
						</text>
					) : null,
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
					className="pointer-events-none absolute top-0 z-10 rounded-lg border border-rule bg-surface px-3 py-2 shadow-float"
					style={{
						left: x(active) + barWidth / 2,
						transform: `translateX(${x(active) > width / 2 ? 'calc(-100% - 12px)' : '12px'})`,
					}}
				>
					<p className="text-base font-semibold tabular-nums">{clicksLabel(point.clicks)}</p>
					<p className="text-sm text-mute">
						{weekdayFormat.format(asDate(point.date))}, {dayLabel(point.date)}
					</p>
				</div>
			)}
		</div>
	);
}
