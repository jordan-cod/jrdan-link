import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { api, type Range } from '../api';
import { type BarItem, BarList } from '../components/BarList';
import { ClickMap, type Selection } from '../components/ClickMap';
import { DailyChart } from '../components/DailyChart';
import { ErrorText } from '../components/ui';
import { loadRegions, loadWorld, regionCodeOf } from '../stats/geo';
import { countryName, deviceName, formatNumber, referrerName } from '../stats/scale';

const RANGES: { value: Range; label: string }[] = [
	{ value: '7d', label: '7 dias' },
	{ value: '30d', label: '30 dias' },
	{ value: '90d', label: '90 dias' },
	{ value: 'all', label: 'Tudo' },
];

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
function syncedLabel(iso: string | null): string {
	if (!iso) return 'Aguardando a primeira sincronização';
	const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
	return `Atualizado ${relative.format(minutes, 'minute')}`;
}

export function StatsPage() {
	const search = useSearch({ from: '/app/stats' });
	const navigate = useNavigate({ from: '/stats' });
	const query = { range: search.range, slug: search.slug };

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
	const { data: links } = useQuery({ queryKey: ['links'], queryFn: api.links });
	const { data: world = [] } = useQuery({ queryKey: ['geo', 'world'], queryFn: loadWorld, staleTime: Infinity });
	const { data: regionShapes } = useQuery({
		queryKey: ['geo', 'admin1', search.country],
		queryFn: () => loadRegions(search.country ?? ''),
		enabled: Boolean(search.country),
		staleTime: Infinity,
	});

	const select = (selection: Selection) =>
		navigate({
			search: (prev) => ({ ...prev, country: selection.country ?? undefined, region: selection.region ?? undefined }),
			resetScroll: false,
		});

	const nameOfCountry = (code: string) =>
		countryName(code, world.find((f) => f.properties.id === code)?.properties.name);
	const nameOfRegion = (code: string, fallback?: string) =>
		regionShapes?.find((f) => regionCodeOf(f) === code)?.properties.name ?? (fallback || code || 'Sem estado');

	const data = overview.data;
	const topLink = data?.links[0];

	const ranking = ((): { title: string; items: BarItem[] } => {
		if (!search.country) {
			return {
				title: 'Países',
				items: (data?.countries ?? []).map((c) => ({
					key: c.code || 'none',
					label: nameOfCountry(c.code),
					clicks: c.clicks,
					onSelect: c.code ? () => select({ country: c.code, region: null }) : undefined,
				})),
			};
		}
		if (!search.region) {
			return {
				title: `Estados · ${nameOfCountry(search.country)}`,
				items: (detail.data?.regions ?? []).map((r) => ({
					key: r.code || 'none',
					label: nameOfRegion(r.code, r.name),
					clicks: r.clicks,
					onSelect: r.code ? () => select({ country: search.country ?? null, region: r.code }) : undefined,
				})),
			};
		}
		return {
			title: `Cidades · ${nameOfRegion(search.region)}`,
			items: (detail.data?.cities ?? [])
				.filter((city) => city.regionCode === search.region)
				.map((city) => ({ key: city.name || 'none', label: city.name || 'Cidade desconhecida', clicks: city.clicks })),
		};
	})();

	const crumbs = [
		{ label: 'Mundo', selection: { country: null, region: null } },
		...(search.country
			? [{ label: nameOfCountry(search.country), selection: { country: search.country, region: null } }]
			: []),
		...(search.country && search.region
			? [{ label: nameOfRegion(search.region), selection: { country: search.country, region: search.region } }]
			: []),
	];

	return (
		<div className="grid gap-8">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<h1 className="text-2xl font-semibold tracking-tight">Cliques</h1>
				<p className="text-sm text-mute">{syncedLabel(data?.syncedAt ?? null)}</p>
			</header>

			<fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
				<legend className="sr-only">Filtros</legend>
				<div className="flex rounded-lg border border-rule bg-surface p-0.5">
					{RANGES.map((range) => (
						<button
							key={range.value}
							type="button"
							aria-pressed={search.range === range.value}
							onClick={() => navigate({ search: (prev) => ({ ...prev, range: range.value }), resetScroll: false })}
							className="rounded-md px-3 py-1.5 text-sm text-mute transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper"
						>
							{range.label}
						</button>
					))}
				</div>
				<select
					value={search.slug ?? ''}
					onChange={(event) =>
						navigate({ search: (prev) => ({ ...prev, slug: event.target.value || undefined }), resetScroll: false })
					}
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
			</fieldset>

			<ErrorText>{overview.error?.message}</ErrorText>

			<dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
				<Stat label="Cliques" value={data ? formatNumber(data.total) : '–'} />
				<Stat label="Países" value={data ? formatNumber(data.countries.filter((c) => c.code).length) : '–'} />
				<Stat
					label="Link mais clicado"
					value={topLink ? `/${topLink.slug}` : '–'}
					detail={topLink ? `${formatNumber(topLink.clicks)} cliques` : undefined}
				/>
			</dl>

			<section aria-labelledby="map-title" className="grid gap-6 lg:grid-cols-[1fr_18rem]">
				<div className="min-w-0">
					<nav aria-label="Nível do mapa" className="mb-3 flex flex-wrap items-center gap-1 text-sm">
						<h2 id="map-title" className="sr-only">
							Mapa de cliques
						</h2>
						{crumbs.map((crumb, i) => (
							<span key={crumb.label} className="flex items-center gap-1">
								{i > 0 && <span className="text-mute/60">/</span>}
								{i === crumbs.length - 1 ? (
									<span className="font-medium">{crumb.label}</span>
								) : (
									<button type="button" onClick={() => select(crumb.selection)} className="text-mute hover:text-ink">
										{crumb.label}
									</button>
								)}
							</span>
						))}
					</nav>
					<ClickMap
						countries={data?.countries ?? []}
						detail={detail.data}
						selection={{ country: search.country ?? null, region: search.region ?? null }}
						onSelect={select}
						dimmed={overview.isFetching || detail.isFetching}
					/>
				</div>
				<div className="min-w-0">
					<h3 className="mb-2 text-sm font-medium">{ranking.title}</h3>
					<BarList items={ranking.items} />
				</div>
			</section>

			<section aria-labelledby="daily-title" className="grid gap-3">
				<h2 id="daily-title" className="font-medium">
					Cliques por dia
				</h2>
				{data && <DailyChart series={data.series} />}
			</section>

			<div className="grid gap-8 md:grid-cols-3">
				<Panel title="Links">
					<BarList
						items={(data?.links ?? []).map((link) => ({
							key: link.slug,
							label: `/${link.slug}`,
							clicks: link.clicks,
							active: search.slug === link.slug,
							onSelect: () =>
								navigate({
									search: (prev) => ({ ...prev, slug: prev.slug === link.slug ? undefined : link.slug }),
									resetScroll: false,
								}),
						}))}
					/>
				</Panel>
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
		<div>
			<dt className="text-sm text-mute">{label}</dt>
			<dd className="mt-1 text-3xl font-semibold tracking-tight">{value}</dd>
			{detail && <dd className="text-sm text-mute">{detail}</dd>}
		</div>
	);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="min-w-0">
			<h2 className="mb-2 font-medium">{title}</h2>
			{children}
		</section>
	);
}
