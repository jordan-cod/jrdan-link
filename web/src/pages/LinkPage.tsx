import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { api } from '../api';
import { ArrowLeftIcon, ExternalIcon } from '../components/icons';
import { type StatsSearch, StatsView } from '../components/StatsView';
import { CopyButton } from '../components/ui';
import { displayUrl, formatDate, shortLabel } from '../format';

export function LinkPage() {
	const { slug } = useParams({ from: '/app/links/$slug' });
	const search = useSearch({ from: '/app/links/$slug' });
	const navigate = useNavigate({ from: '/links/$slug' });
	const { data: links, isPending } = useQuery({ queryKey: ['links'], queryFn: api.links });
	const link = links?.find((item) => item.slug === slug);

	return (
		<div className="grid gap-8">
			<div className="grid gap-4">
				<Link
					to="/links"
					className="flex w-fit items-center gap-1.5 text-sm text-mute transition-colors hover:text-ink"
				>
					<ArrowLeftIcon width={16} height={16} />
					Links
				</Link>

				{isPending ? (
					<p className="text-mute">Carregando…</p>
				) : link ? (
					<header className="flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0">
							<div className="flex items-center gap-1">
								<h1 className="truncate text-2xl font-semibold tracking-tight">{shortLabel(link.shortUrl)}</h1>
								<CopyButton value={link.shortUrl} />
							</div>
							<a
								href={link.url}
								target="_blank"
								rel="noreferrer"
								title={link.url}
								className="mt-1 flex max-w-full items-center gap-1.5 text-mute transition-colors hover:text-ink"
							>
								<span className="truncate">{displayUrl(link.url)}</span>
								<ExternalIcon width={14} height={14} className="shrink-0" />
							</a>
						</div>
						<p className="text-sm text-mute">
							Criado em {formatDate(link.createdAt)}
							{link.expiresAt && `, expira em ${formatDate(link.expiresAt)}`}
						</p>
					</header>
				) : (
					<h1 className="text-2xl font-semibold tracking-tight">jrdan.link/{slug}</h1>
				)}
			</div>

			<StatsView
				scoped
				search={{ ...search, slug }}
				onSearch={(patch: Partial<StatsSearch>) => {
					const { slug: _ignored, ...rest } = patch;
					navigate({ search: (prev) => ({ ...prev, ...rest }), resetScroll: false, replace: true });
				}}
			/>
		</div>
	);
}
