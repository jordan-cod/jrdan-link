import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { api, type Range } from '../api';
import { loadRegions, loadWorld, regionCodeOf } from '../stats/geo';
import { colorScale, countryName, deviceName, formatNumber, referrerName } from '../stats/scale';
import { type BarItem, BarList } from './BarList';
import { ClickMap, type MapArea, MapLegend, type MapPoint, type ProjectionKind } from './ClickMap';
import { DailyChart } from './DailyChart';
import { ErrorText } from './ui';

export interface StatsSearch {
	range: Range;
	slug?: string;
	country?: string;
	region?: string;
}

interface StatsViewProps {
	search: StatsSearch;
	onSearch: (patch: Partial<StatsSearch>) => void;
	scoped?: boolean;
}

const RANGES: { value: Range; label: string }[] = [
	{ value: '7d', label: '7 dias' },
	{ value: '30d', label: '30 dias' },
	{ value: '90d', label: '90 dias' },
	{ value: 'all', label: 'Tudo' },
];

const FOCUS_FILL = '#d6e2f2';
const SHORT_CODE = /^[A-Z]{1,3}$/;

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
function syncedLabel(iso: string | null | undefined): string {
	if (!iso) return 'Aguardando a primeira sincronização';
	return `Atualizado ${relative.format(Math.round((Date.parse(iso) - Date.now()) / 60_000), 'minute')}`;
}

export function StatsView({ search, onSearch, scoped = false }: StatsViewProps) {
	const query = { range: search.range, slug: search.slug };
	const [hovered, setHovered] = useState<string | null>(null);

	const overview = useQuery({
		queryKey: ['stats', query],
		queryFn: () => api.stats(query),
		placeholderData: keepPreviousData,
		refetchInterval: 5 * 60_000,
	});
	const detail = useQuery({
		queryKey: ['stats-country', search.country, query],
		queryFn: () => api.country(search.country ?? '', query),
		enabled: Boolean(search.country),
		placeholderData: keepPreviousData,
	});
	const { data: links } = useQuery({ queryKey: ['links'], queryFn: api.links, enabled: !scoped });
	const { data: world = [] } = useQuery({ queryKey: ['geo', 'world'], queryFn: loadWorld, staleTime: Infinity });
	const { data: regionShapes } = useQuery({
		queryKey: ['geo', 'admin1', search.country],
		queryFn: () => loadRegions(search.country ?? ''),
		enabled: Boolean(search.country),
		staleTime: Infinity,
	});

	const data = overview.data;
	const countryData = search.country ? detail.data : undefined;

	const onSearchRef = useRef(onSearch);
	onSearchRef.current = onSearch;
	const go = useCallback((country: string | null, region: string | null) => {
		setHovered(null);
		onSearchRef.current({ country: country ?? undefined, region: region ?? undefined });
	}, []);

	const view = useMemo(() => {
		const countryFeature = world.find((f) => f.properties.id === search.country);
		const countryLabel = (code: string) =>
			countryName(code, world.find((f) => f.properties.id === code)?.properties.name);
		const shapes = regionShapes ?? [];
		const regionLabel = (code: string, fallback?: string) =>
			shapes.find((f) => regionCodeOf(f) === code)?.properties.name ?? (fallback || 'Sem estado');

		const countryClicks = new Map((data?.countries ?? []).map((c) => [c.code, c.clicks]));
		const regionClicks = new Map((countryData?.regions ?? []).map((r) => [r.code, r.clicks]));
		const cityPoint = (city: NonNullable<typeof countryData>['cities'][number]): MapPoint | null =>
			city.latitude === null || city.longitude === null
				? null
				: {
						key: `p:${city.regionCode}:${city.name}`,
						name: city.name || 'Cidade desconhecida',
						clicks: city.clicks,
						latitude: city.latitude,
						longitude: city.longitude,
					};
		const cityItems = (cities: NonNullable<typeof countryData>['cities']): BarItem[] =>
			cities.map((city) => ({
				key: `p:${city.regionCode}:${city.name}`,
				label: city.name || 'Cidade desconhecida',
				clicks: city.clicks,
			}));

		if (!search.country) {
			const scale = colorScale((data?.countries ?? []).map((c) => c.clicks));
			return {
				key: 'world',
				projection: 'world' as ProjectionKind,
				crumbs: [] as { label: string; country: string | null; region: string | null }[],
				here: 'Mundo',
				rankingTitle: 'Países',
				scale,
				color: scale.color,
				total: data?.total ?? 0,
				areas: world
					.filter((f) => f.properties.id)
					.map(
						(f): MapArea => ({
							key: `c:${f.properties.id}`,
							name: countryLabel(f.properties.id),
							clicks: countryClicks.get(f.properties.id) ?? 0,
							feature: f,
							onSelect: () => go(f.properties.id, null),
						}),
					),
				context: [],
				focus: undefined,
				points: [] as MapPoint[],
				ranking: (data?.countries ?? []).map(
					(c): BarItem => ({
						key: `c:${c.code}`,
						label: countryLabel(c.code),
						clicks: c.clicks,
						onSelect: c.code ? () => go(c.code, null) : undefined,
					}),
				),
				onBack: undefined,
			};
		}

		const country = search.country;
		const countryTotal = countryData?.total ?? countryClicks.get(country) ?? 0;
		const projection: ProjectionKind = country === 'US' && !search.region ? 'usa' : 'local';
		const crumbs = [{ label: 'Mundo', country: null, region: null }];

		if (!search.region) {
			const scale = colorScale((countryData?.regions ?? []).map((r) => r.clicks));
			const withRegions = shapes.length > 0;
			return {
				key: `country:${country}`,
				projection,
				crumbs,
				here: countryLabel(country),
				rankingTitle: withRegions ? 'Estados e regiões' : 'Cidades',
				scale,
				color: scale.color,
				total: countryTotal,
				areas: withRegions
					? shapes.map(
							(f): MapArea => ({
								key: `r:${regionCodeOf(f)}`,
								name: f.properties.name,
								label: SHORT_CODE.test(regionCodeOf(f)) ? regionCodeOf(f) : undefined,
								clicks: regionClicks.get(regionCodeOf(f)) ?? 0,
								feature: f,
								onSelect: () => go(country, regionCodeOf(f)),
							}),
						)
					: countryFeature
						? [{ key: `c:${country}`, name: countryLabel(country), clicks: countryTotal, feature: countryFeature }]
						: [],
				context: [],
				focus: countryFeature,
				points: withRegions ? [] : (countryData?.cities ?? []).map(cityPoint).filter((p) => p !== null),
				ranking: withRegions
					? (countryData?.regions ?? []).map(
							(r): BarItem => ({
								key: `r:${r.code}`,
								label: regionLabel(r.code, r.name),
								clicks: r.clicks,
								onSelect: r.code ? () => go(country, r.code) : undefined,
							}),
						)
					: cityItems(countryData?.cities ?? []),
				onBack: () => go(null, null),
			};
		}

		const region = search.region;
		const regionFeature = shapes.find((f) => regionCodeOf(f) === region);
		const cities = (countryData?.cities ?? []).filter((city) => city.regionCode === region);
		const regionTotal = regionClicks.get(region) ?? 0;
		return {
			key: `region:${country}:${region}`,
			projection,
			crumbs: [...crumbs, { label: countryLabel(country), country, region: null }],
			here: regionLabel(region),
			rankingTitle: 'Cidades',
			scale: null,
			color: () => FOCUS_FILL,
			total: regionTotal,
			areas: regionFeature
				? [{ key: `r:${region}`, name: regionLabel(region), clicks: regionTotal, feature: regionFeature }]
				: [],
			context: shapes.filter((f) => regionCodeOf(f) !== region),
			focus: regionFeature,
			points: cities.map(cityPoint).filter((p) => p !== null),
			ranking: cityItems(cities),
			onBack: () => go(country, null),
		};
	}, [search.country, search.region, world, regionShapes, data, countryData, go]);

	const topLink = data?.links[0];
	const topReferrer = data?.referrers[0];

	return (
		<div className="grid gap-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
					<legend className="sr-only">Filtros</legend>
					<div className="flex rounded-lg border border-rule bg-surface p-0.5">
						{RANGES.map((range) => (
							<button
								key={range.value}
								type="button"
								aria-pressed={search.range === range.value}
								onClick={() => onSearch({ range: range.value })}
								className="rounded-md px-3 py-1.5 text-sm text-mute transition-colors hover:text-ink aria-pressed:bg-wash aria-pressed:font-medium aria-pressed:text-ink"
							>
								{range.label}
							</button>
						))}
					</div>
					{!scoped && (
						<select
							value={search.slug ?? ''}
							onChange={(event) => onSearch({ slug: event.target.value || undefined })}
							aria-label="Link"
							className="h-9 rounded-lg border border-rule bg-surface px-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
						>
							<option value="">Todos os links</option>
							{links?.map((link) => (
								<option key={link.slug} value={link.slug}>
									jrdan.link/{link.slug}
								</option>
							))}
						</select>
					)}
				</fieldset>
				<p className="text-sm text-mute">{syncedLabel(data?.syncedAt)}</p>
			</div>

			<ErrorText>{overview.error?.message}</ErrorText>

			<dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
				<Stat label="Cliques" value={data ? formatNumber(data.total) : '–'} />
				<Stat label="Países" value={data ? formatNumber(data.countries.filter((c) => c.code).length) : '–'} />
				{scoped ? (
					<Stat
						label="Origem principal"
						value={topReferrer ? referrerName(topReferrer.host) : '–'}
						detail={topReferrer ? `${formatNumber(topReferrer.clicks)} cliques` : undefined}
					/>
				) : (
					<Stat
						label="Link mais clicado"
						value={topLink ? `/${topLink.slug}` : '–'}
						detail={topLink ? `${formatNumber(topLink.clicks)} cliques` : undefined}
					/>
				)}
			</dl>

			<section aria-labelledby="map-title" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
				<div className="grid min-w-0 gap-3">
					<div className="flex items-center gap-1.5 text-sm">
						{view.crumbs.map((crumb) => (
							<span key={crumb.label} className="flex items-center gap-1.5">
								<button
									type="button"
									onClick={() => go(crumb.country, crumb.region)}
									className="text-mute transition-colors hover:text-ink"
								>
									{crumb.label}
								</button>
								<span className="text-mute/50">/</span>
							</span>
						))}
						<h2 id="map-title" className="font-medium">
							{view.here}
						</h2>
					</div>
					<ClickMap
						viewKey={view.key}
						projection={view.projection}
						areas={view.areas}
						context={view.context}
						focus={view.focus}
						points={view.points}
						total={view.total}
						color={view.color}
						hovered={hovered}
						onHover={setHovered}
						onBack={view.onBack}
						dimmed={overview.isFetching || detail.isFetching}
					/>
					{view.scale && <MapLegend classes={view.scale.classes} />}
				</div>
				<div className="min-w-0">
					<h3 className="mb-2 text-sm font-medium">{view.rankingTitle}</h3>
					<BarList items={view.ranking} hovered={hovered} onHover={setHovered} />
				</div>
			</section>

			<section aria-labelledby="daily-title" className="grid gap-3">
				<h2 id="daily-title" className="font-medium">
					Cliques por dia
				</h2>
				{data && <DailyChart series={data.series} />}
			</section>

			<div className={`grid gap-8 ${scoped ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
				{!scoped && (
					<Panel title="Links">
						<BarList
							items={(data?.links ?? []).map((link) => ({
								key: link.slug,
								label: `/${link.slug}`,
								clicks: link.clicks,
								onSelect: () => onSearch({ slug: search.slug === link.slug ? undefined : link.slug }),
							}))}
						/>
					</Panel>
				)}
				<Panel title="Origem">
					<BarList
						items={(data?.referrers ?? []).map((r) => ({
							key: r.host || 'direct',
							label: referrerName(r.host),
							clicks: r.clicks,
						}))}
					/>
				</Panel>
				<Panel title="Dispositivo">
					<BarList
						items={(data?.devices ?? []).map((d) => ({ key: d.device, label: deviceName(d.device), clicks: d.clicks }))}
					/>
				</Panel>
			</div>

			{data && data.bots > 0 && (
				<p className="text-sm text-mute">
					{formatNumber(data.bots)} {data.bots === 1 ? 'acesso de robô ficou' : 'acessos de robôs ficaram'} de fora da
					contagem, como prévias de link no WhatsApp e no LinkedIn.
				</p>
			)}
		</div>
	);
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="min-w-0">
			<dt className="text-sm text-mute">{label}</dt>
			<dd className="mt-1 truncate text-3xl font-semibold tracking-tight">{value}</dd>
			{detail && <dd className="text-sm text-mute">{detail}</dd>}
		</div>
	);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="min-w-0">
			<h2 className="mb-2 font-medium">{title}</h2>
			{children}
		</section>
	);
}
