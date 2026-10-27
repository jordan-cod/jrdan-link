import { useQuery } from '@tanstack/react-query';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { MultiPolygon, Polygon } from 'geojson';
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from 'react';
import type { CountryDetail } from '../api';
import { loadRegions, loadWorld, type PlaceFeature, regionCodeOf } from '../stats/geo';
import { clicksLabel, colorScale, countryName, EMPTY_FILL, formatNumber, RAMP } from '../stats/scale';

const WIDTH = 960;
const HEIGHT = 421;
const MAX_ZOOM = 60;
const PAPER = '#f5f6f7';
const INK = '#15171a';
const FOCUS_FILL = '#d6e2f2';

export interface Selection {
	country: string | null;
	region: string | null;
}

interface ClickMapProps {
	countries: { code: string; clicks: number }[];
	detail: CountryDetail | undefined;
	selection: Selection;
	onSelect: (selection: Selection) => void;
	dimmed?: boolean;
}

interface Tip {
	x: number;
	y: number;
	title: string;
	clicks: number;
}

const LAND_EXTENT = {
	type: 'MultiPoint' as const,
	coordinates: [-180, -90, 0, 90, 180].flatMap((longitude) => [
		[longitude, -56],
		[longitude, 0],
		[longitude, 84],
	]),
};

const projection = geoNaturalEarth1().fitExtent(
	[
		[6, 6],
		[WIDTH - 6, HEIGHT - 6],
	],
	LAND_EXTENT,
);
const path = geoPath(projection);

function mainlandBounds(feature: PlaceFeature): [[number, number], [number, number]] {
	const geometry = feature.geometry;
	if (geometry.type !== 'MultiPolygon') return path.bounds(feature);

	const parts = (geometry as MultiPolygon).coordinates.map((coordinates) => {
		const polygon: Polygon = { type: 'Polygon', coordinates };
		return { area: path.area(polygon), bounds: path.bounds(polygon) };
	});
	const largest = Math.max(...parts.map((part) => part.area));
	const kept = parts.filter((part) => part.area >= largest * 0.2);

	return [
		[Math.min(...kept.map((p) => p.bounds[0][0])), Math.min(...kept.map((p) => p.bounds[0][1]))],
		[Math.max(...kept.map((p) => p.bounds[1][0])), Math.max(...kept.map((p) => p.bounds[1][1]))],
	];
}

function onActivate(action: () => void) {
	return (event: KeyboardEvent) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		action();
	};
}

function zoomTo(bounds: [[number, number], [number, number]] | null) {
	if (!bounds) return { k: 1, x: 0, y: 0 };
	const [[x0, y0], [x1, y1]] = bounds;
	const k = Math.min(MAX_ZOOM, 0.86 / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT));
	return { k, x: WIDTH / 2 - (k * (x0 + x1)) / 2, y: HEIGHT / 2 - (k * (y0 + y1)) / 2 };
}

export function ClickMap({ countries, detail, selection, onSelect, dimmed = false }: ClickMapProps) {
	const container = useRef<HTMLDivElement>(null);
	const [tip, setTip] = useState<Tip | null>(null);
	const [hovered, setHovered] = useState<string | null>(null);

	const { data: world = [] } = useQuery({ queryKey: ['geo', 'world'], queryFn: loadWorld, staleTime: Infinity });
	const { data: regions } = useQuery({
		queryKey: ['geo', 'admin1', selection.country],
		queryFn: () => loadRegions(selection.country ?? ''),
		enabled: Boolean(selection.country),
		staleTime: Infinity,
	});

	const countryClicks = useMemo(() => new Map(countries.map((c) => [c.code, c.clicks])), [countries]);
	const regionClicks = useMemo(() => new Map((detail?.regions ?? []).map((r) => [r.code, r.clicks])), [detail]);

	const worldScale = useMemo(() => colorScale(countries.map((c) => c.clicks)), [countries]);
	const regionScale = useMemo(() => colorScale((detail?.regions ?? []).map((r) => r.clicks)), [detail]);

	const countryFeature = world.find((f) => f.properties.id === selection.country);
	const regionFeature = regions?.find((f) => regionCodeOf(f) === selection.region);
	const hasRegions = Boolean(selection.country && regions && regions.length > 0);

	const zoom = useMemo(() => {
		if (regionFeature) return zoomTo(mainlandBounds(regionFeature));
		if (countryFeature) return zoomTo(mainlandBounds(countryFeature));
		return zoomTo(null);
	}, [regionFeature, countryFeature]);

	const cities = useMemo(() => {
		if (!detail || !selection.country) return [];
		if (hasRegions && !selection.region) return [];
		return detail.cities
			.filter((city) => city.latitude !== null && city.longitude !== null)
			.filter((city) => !selection.region || city.regionCode === selection.region)
			.map((city) => {
				const point = projection([city.longitude ?? 0, city.latitude ?? 0]);
				return point ? { ...city, x: point[0], y: point[1] } : null;
			})
			.filter((city) => city !== null);
	}, [detail, selection, hasRegions]);

	const maxCity = Math.max(1, ...cities.map((city) => city.clicks));
	const scale = selection.country ? regionScale : worldScale;

	function showTip(event: PointerEvent, title: string, clicks: number, id: string) {
		const box = container.current?.getBoundingClientRect();
		if (!box) return;
		setHovered(id);
		setTip({ x: event.clientX - box.left, y: event.clientY - box.top, title, clicks });
	}

	function zoomOut() {
		if (selection.region) onSelect({ country: selection.country, region: null });
		else if (selection.country) onSelect({ country: null, region: null });
	}

	function hideTip() {
		setHovered(null);
		setTip(null);
	}

	const regionLabels = useMemo(() => {
		if (!regions || selection.region) return [];
		return regions
			.map((feature) => ({
				feature,
				code: regionCodeOf(feature),
				clicks: regionClicks.get(regionCodeOf(feature)) ?? 0,
			}))
			.filter((entry) => entry.clicks > 0)
			.map((entry) => {
				const [x, y] = path.centroid(entry.feature);
				return { ...entry, x, y };
			});
	}, [regions, regionClicks, selection.region]);

	return (
		<div ref={container} className="relative">
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className={`block h-auto w-full transition-opacity duration-200 ${dimmed ? 'opacity-60' : ''}`}
				role="group"
				aria-label="Mapa de cliques por local"
			>
				<rect
					width={WIDTH}
					height={HEIGHT}
					fill="transparent"
					role="button"
					tabIndex={-1}
					aria-label="Voltar um nível"
					onClick={zoomOut}
					onKeyDown={onActivate(zoomOut)}
				/>
				<g
					style={{
						transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.k})`,
						transformOrigin: '0 0',
						transition: 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
					}}
				>
					{world.map((feature) => {
						const code = feature.properties.id;
						const clicks = countryClicks.get(code) ?? 0;
						const selected = code === selection.country;
						const fill = selection.country
							? selected && !hasRegions
								? regionScale.color(detail?.total ?? clicks)
								: '#eceef1'
							: worldScale.color(clicks);

						const name = countryName(code, feature.properties.name);
						const open = () => code && !selected && onSelect({ country: code, region: null });
						return (
							<path
								key={code || feature.properties.name}
								role="button"
								tabIndex={code && clicks > 0 && !selection.country ? 0 : -1}
								aria-label={`${name}: ${clicksLabel(clicks)}`}
								onKeyDown={onActivate(open)}
								d={path(feature) ?? undefined}
								fill={fill}
								stroke={hovered === `c:${code}` ? INK : PAPER}
								strokeWidth={hovered === `c:${code}` ? 1.5 : 0.6}
								vectorEffect="non-scaling-stroke"
								className={code ? 'cursor-pointer' : undefined}
								onPointerMove={(event) => code && showTip(event, name, clicks, `c:${code}`)}
								onPointerLeave={hideTip}
								onClick={open}
							/>
						);
					})}

					{hasRegions &&
						regions?.map((feature) => {
							const code = regionCodeOf(feature);
							const clicks = regionClicks.get(code) ?? 0;
							const open = () => onSelect({ country: selection.country, region: code });
							return (
								<path
									key={feature.properties.id}
									role="button"
									tabIndex={clicks > 0 && !selection.region ? 0 : -1}
									aria-label={`${feature.properties.name}: ${clicksLabel(clicks)}`}
									onKeyDown={onActivate(open)}
									d={path(feature) ?? undefined}
									fill={
										selection.region ? (code === selection.region ? FOCUS_FILL : '#eceef1') : regionScale.color(clicks)
									}
									stroke={hovered === `r:${code}` ? INK : PAPER}
									strokeWidth={hovered === `r:${code}` ? 1.5 : 0.75}
									vectorEffect="non-scaling-stroke"
									className="cursor-pointer"
									onPointerMove={(event) => showTip(event, feature.properties.name, clicks, `r:${code}`)}
									onPointerLeave={hideTip}
									onClick={open}
								/>
							);
						})}

					{regionLabels.map((label) => (
						<text
							key={label.code}
							x={label.x}
							y={label.y}
							textAnchor="middle"
							dominantBaseline="central"
							fontSize={11 / zoom.k}
							fontWeight={600}
							fill={INK}
							stroke={PAPER}
							strokeWidth={3 / zoom.k}
							paintOrder="stroke"
							pointerEvents="none"
						>
							{label.code} {formatNumber(label.clicks)}
						</text>
					))}

					{cities.map((city) => {
						const radius = (5 + 14 * Math.sqrt(city.clicks / maxCity)) / zoom.k;
						const id = `p:${city.regionCode}:${city.name}`;
						return (
							<g key={id}>
								<circle
									cx={city.x}
									cy={city.y}
									r={radius}
									fill={RAMP[4]}
									fillOpacity={0.85}
									stroke={PAPER}
									strokeWidth={hovered === id ? 2.5 : 1.5}
									vectorEffect="non-scaling-stroke"
									pointerEvents="none"
								/>
								<circle
									cx={city.x}
									cy={city.y}
									r={Math.max(radius, 12 / zoom.k)}
									fill="transparent"
									role="img"
									aria-label={`${city.name || 'Cidade desconhecida'}: ${clicksLabel(city.clicks)}`}
									onPointerMove={(event) => showTip(event, city.name || 'Cidade desconhecida', city.clicks, id)}
									onPointerLeave={hideTip}
								/>
							</g>
						);
					})}
				</g>
			</svg>

			{tip && (
				<div
					className="pointer-events-none absolute z-10 rounded-md border border-rule bg-surface px-2.5 py-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.08)]"
					style={{
						left: tip.x,
						top: tip.y,
						transform: `translate(${tip.x > (container.current?.clientWidth ?? 0) / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
					}}
				>
					<p className="text-sm font-semibold tabular-nums">{clicksLabel(tip.clicks)}</p>
					<p className="text-xs text-mute">{tip.title}</p>
				</div>
			)}

			{!selection.region && <Legend classes={scale.classes} />}
		</div>
	);
}

function Legend({ classes }: { classes: { from: number; to: number; color: string }[] }) {
	if (classes.length === 0) return null;
	return (
		<ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute" aria-label="Legenda">
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
