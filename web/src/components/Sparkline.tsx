import { RAMP } from '../stats/scale';

export function Sparkline({ values, width = 120, height = 36 }: { values: number[]; width?: number; height?: number }) {
	if (values.length < 2) return null;
	const max = Math.max(1, ...values);
	const points = values.map((value, i) => [
		(i / (values.length - 1)) * width,
		height - 2 - (value / max) * (height - 4),
	]);
	const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x?.toFixed(1)},${y?.toFixed(1)}`).join('');
	const area = `${line}L${width},${height}L0,${height}Z`;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
			className="overflow-visible"
		>
			<defs>
				<linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor={RAMP[1]} stopOpacity={0.22} />
					<stop offset="100%" stopColor={RAMP[1]} stopOpacity={0} />
				</linearGradient>
			</defs>
			<path d={area} fill="url(#spark-fill)" />
			<path d={line} fill="none" stroke={RAMP[2]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
		</svg>
	);
}
