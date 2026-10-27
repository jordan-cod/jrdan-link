import { type GeoProjection, geoAlbersUsa, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from 'react';
import type { PlaceFeature } from '../stats/geo';
import { clicksLabel, EMPTY_FILL, formatNumber, RAMP } from '../stats/scale';

const WIDTH = 960;
const HEIGHT = 440;
const PAD = 20;
const PAPER = '#f5f6f7';
const INK = '#15171a';
const CONTEXT_FILL = '#e9ecf0';

export type ProjectionKind = 'world' | 'usa' | 'local';

export interface MapArea {
	key: string;
	name: string;
	label?: string;
	clicks: number;
	feature: PlaceFeature;
	onSelect?: () => void;
}

export interface MapPoint {
	key: string;
	name: string;
	clicks: number;
	longitude: number;
	latitude: number;
}

interface ClickMapProps {
	viewKey: string;
	projection: ProjectionKind;
	areas: MapArea[];
	context?: PlaceFeature[];
	focus?: PlaceFeature;
	points?: MapPoint[];
	total: number;
	color: (clicks: number) => string;
	hovered: string | null;
	onHover: (key: string | null) => void;
	onBack?: () => void;
	dimmed?: boolean;
}

const LAND_EXTENT = {
	type: 'MultiPoint' as const,
	coordinates: [-180, -90, 0, 90, 180].flatMap((longitude) => [
		[longitude, -56],
		[longitude, 0],
		[longitude, 84],
	]),
};

const EXTENT: [[number, number], [number, number]] = [
	[PAD, PAD],
	[WIDTH - PAD, HEIGHT - PAD],
];

function mainland(feature: PlaceFeature): Feature<Geometry> {
	if (feature.geometry.type !== 'MultiPolygon') return feature;
	const area = geoPath(geoMercator());
	const parts = (feature.geometry as MultiPolygon).coordinates.map((coordinates) => ({
		coordinates,
		size: area.area({ type: 'Polygon', coordinates } as Polygon),
	}));
	const largest = Math.max(...parts.map((part) => part.size));
	return {
		type: 'Feature',
		properties: {},
		geometry: {
			type: 'MultiPolygon',
			coordinates: parts.filter((part) => part.size >= largest * 0.2).map((part) => part.coordinates),
		},
	};
}

function buildProjection(kind: ProjectionKind, areas: MapArea[], focus?: PlaceFeature): GeoProjection {
	if (kind === 'world') return geoNaturalEarth1().fitExtent(EXTENT, LAND_EXTENT);

	const target: FeatureCollection = {
		type: 'FeatureCollection',
		features: focus ? [mainland(focus)] : areas.map((area) => area.feature),
	};

	if (kind === 'usa') return geoAlbersUsa().fitExtent(EXTENT, target) as unknown as GeoProjection;
	return geoMercator().fitExtent(EXTENT, target);
}

function onActivate(action: () => void) {
	return (event: KeyboardEvent) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		action();
	};
}

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const share = (clicks: number, total: number) => `${percent.format((clicks / total) * 100)}% do total`;

export function ClickMap({
	viewKey,
	projection: kind,
	areas,
	context = [],
	focus,
	points = [],
	total,
	color,
	hovered,
	onHover,
	onBack,
	dimmed = false,
}: ClickMapProps) {
	const container = useRef<HTMLDivElement>(null);
	const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

	const projection = useMemo(() => buildProjection(kind, areas, focus), [kind, areas, focus]);
	const path = useMemo(() => geoPath(projection), [projection]);

	const shapes = useMemo(
		() => areas.map((area) => ({ ...area, d: path(area.feature) ?? '', size: path.area(area.feature) })),
		[areas, path],
	);

	const contextPaths = useMemo(
		() => context.map((feature) => ({ id: feature.properties.id, d: path(feature) ?? '' })),
		[context, path],
	);

	const labels = useMemo(
		() =>
			shapes
				.filter((shape) => shape.label && shape.clicks > 0 && shape.size > 900)
				.map((shape) => {
					const [x, y] = path.centroid(shape.feature);
					return { key: shape.key, text: shape.label ?? '', x, y };
				})
				.filter((label) => Number.isFinite(label.x) && Number.isFinite(label.y)),
		[shapes, path],
	);

	const dots = useMemo(() => {
		const max = Math.max(1, ...points.map((point) => point.clicks));
		const placed = points
			.map((point) => {
				const xy = projection([point.longitude, point.latitude]);
				return xy ? { ...point, x: xy[0], y: xy[1], r: 5 + 13 * Math.sqrt(point.clicks / max) } : null;
			})
			.filter((point) => point !== null)
			.sort((a, b) => b.clicks - a.clicks);

		const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
		return placed.map((point, index) => {
			const box = {
				x0: point.x + point.r + 4,
				x1: point.x + point.r + 6 + point.name.length * 6.6,
				y0: point.y - 8,
				y1: point.y + 8,
			};
			const free =
				index < 8 &&
				box.x1 < WIDTH &&
				boxes.every((other) => box.x1 < other.x0 || box.x0 > other.x1 || box.y1 < other.y0 || box.y0 > other.y1);
			if (free) boxes.push(box);
			return { ...point, showLabel: free };
		});
	}, [points, projection]);

	const lookup = useMemo(() => {
		const map = new Map<string, { name: string; clicks: number }>();
		for (const shape of shapes) map.set(shape.key, shape);
		for (const dot of dots) map.set(dot.key, dot);
		return map;
	}, [shapes, dots]);

	const hoveredShape = shapes.find((shape) => shape.key === hovered);
	const tip = hovered ? lookup.get(hovered) : undefined;
	const focusing = Boolean(hovered && lookup.has(hovered));

	function track(event: PointerEvent, key: string) {
		const box = container.current?.getBoundingClientRect();
		if (box) setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
		if (key !== hovered) onHover(key);
	}

	function leave() {
		setPointer(null);
		onHover(null);
	}

	const width = container.current?.clientWidth ?? 0;
	const height = container.current?.clientHeight ?? 0;

	return (
		<div ref={container} className="relative overflow-hidden rounded-xl border border-rule bg-surface">
			<svg
				key={viewKey}
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className={`map-enter block h-auto w-full transition-opacity duration-200 ${dimmed ? 'opacity-60' : ''}`}
				role="group"
				aria-label="Mapa de cliques"
			>
				<rect
					width={WIDTH}
					height={HEIGHT}
					fill="transparent"
					role="button"
					tabIndex={-1}
					aria-label="Voltar um nível"
					onClick={onBack}
					onKeyDown={onBack ? onActivate(onBack) : undefined}
					className={onBack ? 'cursor-zoom-out' : undefined}
				/>

				{contextPaths.map((shape) => (
					<path key={shape.id} d={shape.d} fill={CONTEXT_FILL} stroke={PAPER} strokeWidth={0.75} pointerEvents="none" />
				))}

				{shapes.map((shape) => (
					<path
						key={shape.key}
						d={shape.d}
						fill={shape.clicks > 0 ? color(shape.clicks) : EMPTY_FILL}
						fillOpacity={focusing && hovered !== shape.key ? 0.72 : 1}
						stroke={PAPER}
						strokeWidth={0.75}
						role="button"
						tabIndex={shape.onSelect && shape.clicks > 0 ? 0 : -1}
						aria-label={`${shape.name}: ${clicksLabel(shape.clicks)}`}
						className={`outline-none transition-[fill-opacity] duration-150 ${shape.onSelect ? 'cursor-pointer' : ''}`}
						onPointerMove={(event) => track(event, shape.key)}
						onPointerLeave={leave}
						onFocus={() => onHover(shape.key)}
						onBlur={() => onHover(null)}
						onClick={shape.onSelect}
						onKeyDown={shape.onSelect ? onActivate(shape.onSelect) : undefined}
					/>
				))}

				{hoveredShape && (
					<path
						d={hoveredShape.d}
						fill="none"
						stroke={INK}
						strokeWidth={1.75}
						strokeLinejoin="round"
						pointerEvents="none"
					/>
				)}

				{labels.map((label) => (
					<text
						key={label.key}
						x={label.x}
						y={label.y}
						textAnchor="middle"
						dominantBaseline="central"
						fontSize={11}
						fontWeight={600}
						letterSpacing="0.02em"
						fill={INK}
						stroke={PAPER}
						strokeWidth={3}
						strokeOpacity={0.9}
						paintOrder="stroke"
						pointerEvents="none"
					>
						{label.text}
					</text>
				))}

				{dots.map((dot) => (
					<g key={dot.key}>
						<circle
							cx={dot.x}
							cy={dot.y}
							r={dot.r}
							fill={RAMP[3]}
							fillOpacity={hovered && hovered !== dot.key ? 0.55 : 0.9}
							stroke={hovered === dot.key ? INK : '#ffffff'}
							strokeWidth={hovered === dot.key ? 2 : 1.5}
							pointerEvents="none"
						/>
						{dot.showLabel && (
							<text
								x={dot.x + dot.r + 5}
								y={dot.y}
								dominantBaseline="central"
								fontSize={12}
								fontWeight={500}
								fill={INK}
								stroke={PAPER}
								strokeWidth={3}
								paintOrder="stroke"
								pointerEvents="none"
							>
								{dot.name}
							</text>
						)}
						<circle
							cx={dot.x}
							cy={dot.y}
							r={Math.max(dot.r, 12)}
							fill="transparent"
							role="img"
							aria-label={`${dot.name}: ${clicksLabel(dot.clicks)}`}
							onPointerMove={(event) => track(event, dot.key)}
							onPointerLeave={leave}
						/>
					</g>
				))}
			</svg>

			{tip && pointer && (
				<div
					className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-rule bg-surface px-3 py-2 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.2)]"
					style={{
						left: pointer.x,
						top: pointer.y,
						transform: `translate(${pointer.x > width / 2 ? 'calc(-100% - 14px)' : '14px'}, ${
							pointer.y > height / 2 ? 'calc(-100% - 6px)' : '6px'
						})`,
					}}
				>
					<p className="text-base font-semibold tabular-nums">{clicksLabel(tip.clicks)}</p>
					<p className="text-sm">{tip.name}</p>
					{total > 0 && tip.clicks > 0 && <p className="text-xs text-mute">{share(tip.clicks, total)}</p>}
				</div>
			)}
		</div>
	);
}

export function MapLegend({ classes }: { classes: { from: number; to: number; color: string }[] }) {
	if (classes.length === 0) return null;
	return (
		<ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute" aria-label="Legenda">
			<li className="flex items-center gap-1.5">
				<span className="size-2.5 rounded-sm" style={{ background: EMPTY_FILL }} />
				Nenhum
			</li>
			{classes.map((step) => (
				<li key={step.from} className="flex items-center gap-1.5 tabular-nums">
					<span className="size-2.5 rounded-sm" style={{ background: step.color }} />
					{step.from === step.to ? formatNumber(step.from) : `${formatNumber(step.from)}–${formatNumber(step.to)}`}
				</li>
			))}
		</ul>
	);
}
