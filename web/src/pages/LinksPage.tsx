import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { api, type Link } from '../api';
import { Card } from '../components/Card';
import { Button, CopyButton, ErrorText, Input } from '../components/ui';
import { displayUrl, formatDate, shortLabel } from '../format';

const EXPIRY_OPTIONS = [
	{ label: 'Nunca expira', days: 0 },
	{ label: 'Expira em 1 dia', days: 1 },
	{ label: 'Expira em 7 dias', days: 7 },
	{ label: 'Expira em 30 dias', days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return '';
	}
}

function Favicon({ url }: { url: string }) {
	const host = hostOf(url);
	const [failed, setFailed] = useState(false);
	return (
		<span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-rule bg-surface shadow-card">
			{host && !failed ? (
				<img
					src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
					alt=""
					width={18}
					height={18}
					className="size-[18px]"
					onError={() => setFailed(true)}
				/>
			) : (
				<span className="text-sm font-semibold text-mute uppercase">{host.replace(/^www\./, '').charAt(0) || '?'}</span>
			)}
		</span>
	);
}

export function LinksPage() {
	const { data: links, isPending, error } = useQuery({ queryKey: ['links'], queryFn: api.links });
	const [search, setSearch] = useState('');

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!links || !term) return links ?? [];
		return links.filter((link) => link.slug.toLowerCase().includes(term) || link.url.toLowerCase().includes(term));
	}, [links, search]);

	return (
		<div className="mx-auto grid max-w-4xl gap-6">
			<header>
				<h1 className="text-[1.75rem] font-semibold tracking-tight">Links</h1>
				<p className="mt-1 text-mute">Crie, edite e acompanhe os links curtos do jrdan.link.</p>
			</header>

			<CreateLink />

			<Card
				title={
					<span className="flex items-center gap-2">
						Todos os links
						{links && (
							<span className="rounded-md bg-wash px-1.5 py-0.5 text-xs font-medium text-mute tabular-nums">
								{links.length}
							</span>
						)}
					</span>
				}
				action={
					links &&
					links.length > 0 && (
						<Input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Buscar por código ou destino"
							aria-label="Buscar links"
							className="h-9 max-w-64"
						/>
					)
				}
				bodyClassName=""
			>
				{isPending && <p className="p-5 text-mute">Carregando…</p>}
				<div className="px-5">
					<ErrorText>{error?.message}</ErrorText>
				</div>

				{links && links.length === 0 && (
					<p className="px-5 py-12 text-center text-mute">
						Nenhum link ainda. Cole uma URL acima pra criar o primeiro.
					</p>
				)}

				{links && links.length > 0 && visible.length === 0 && (
					<p className="px-5 py-12 text-center text-mute">Nenhum link com “{search}”.</p>
				)}

				{visible.length > 0 && (
					<ul className="divide-y divide-rule">
						{visible.map((link) => (
							<LinkRow key={link.slug} link={link} />
						))}
					</ul>
				)}
			</Card>
		</div>
	);
}

function CreateLink() {
	const queryClient = useQueryClient();
	const [url, setUrl] = useState('');
	const [slug, setSlug] = useState('');
	const [days, setDays] = useState(0);
	const [created, setCreated] = useState<{ link: Link; copied: boolean } | null>(null);

	const create = useMutation({
		mutationFn: api.createLink,
		onSuccess: async (link) => {
			const copied = await navigator.clipboard.writeText(link.shortUrl).then(
				() => true,
				() => false,
			);
			setCreated({ link, copied });
			setUrl('');
			setSlug('');
			setDays(0);
			await queryClient.invalidateQueries({ queryKey: ['links'] });
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		setCreated(null);
		create.mutate({
			url,
			slug: slug.trim() || null,
			expiresAt: days ? new Date(Date.now() + days * DAY_MS).toISOString() : null,
		});
	}

	return (
		<Card title="Encurtar um link">
			<form onSubmit={submit} className="grid gap-3">
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						type="url"
						required
						autoFocus
						value={url}
						onChange={(event) => setUrl(event.target.value)}
						placeholder="Cole a URL de destino"
						aria-label="URL de destino"
						className="h-12 rounded-xl text-base"
					/>
					<Button type="submit" variant="primary" className="h-12 rounded-xl px-6" disabled={create.isPending}>
						{create.isPending ? 'Encurtando…' : 'Encurtar'}
					</Button>
				</div>

				<div className="flex flex-wrap items-center gap-2 text-sm">
					<label className="flex items-center rounded-lg border border-rule bg-surface pl-3 focus-within:border-ink/40">
						<span className="text-mute">jrdan.link/</span>
						<input
							value={slug}
							onChange={(event) => setSlug(event.target.value)}
							placeholder="código opcional"
							aria-label="Código personalizado"
							pattern="[a-zA-Z0-9_\-]{2,32}"
							title="De 2 a 32 letras, números, hífen ou underline"
							className="h-9 w-40 bg-transparent pr-3 placeholder:text-mute/70 focus:outline-none"
						/>
					</label>
					<select
						value={days}
						onChange={(event) => setDays(Number(event.target.value))}
						aria-label="Expiração"
						className="h-9 rounded-lg border border-rule bg-surface px-2.5 text-ink focus:border-ink/40 focus:outline-none"
					>
						{EXPIRY_OPTIONS.map((option) => (
							<option key={option.days} value={option.days}>
								{option.label}
							</option>
						))}
					</select>
				</div>

				<ErrorText>{create.error?.message}</ErrorText>
			</form>

			{created && (
				<div
					role="status"
					className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-ok/25 bg-ok/6 py-2 pr-2 pl-4"
				>
					<p className="min-w-0 truncate">
						<span className="font-semibold">{shortLabel(created.link.shortUrl)}</span>
						<span className="text-mute">{created.copied ? ' criado e copiado.' : ' criado.'}</span>
					</p>
					<CopyButton value={created.link.shortUrl} />
				</div>
			)}
		</Card>
	);
}

function LinkRow({ link }: { link: Link }) {
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [draft, setDraft] = useState(link.url);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['links'] });

	const update = useMutation({
		mutationFn: (url: string) => api.updateLink(link.slug, { url }),
		onSuccess: async () => {
			setEditing(false);
			await refresh();
		},
	});

	const remove = useMutation({ mutationFn: () => api.deleteLink(link.slug), onSuccess: refresh });

	if (editing) {
		return (
			<li className="px-5 py-4">
				<form
					className="grid gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						update.mutate(draft);
					}}
				>
					<p className="font-semibold">{shortLabel(link.shortUrl)}</p>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							type="url"
							required
							autoFocus
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							aria-label={`Novo destino de ${link.slug}`}
						/>
						<div className="flex gap-2">
							<Button type="submit" variant="primary" disabled={update.isPending}>
								Salvar
							</Button>
							<Button
								variant="ghost"
								onClick={() => {
									setEditing(false);
									setDraft(link.url);
									update.reset();
								}}
							>
								Cancelar
							</Button>
						</div>
					</div>
					<ErrorText>{update.error?.message}</ErrorText>
				</form>
			</li>
		);
	}

	return (
		<li className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-paper/60 sm:flex-row sm:items-center">
			<div className="flex min-w-0 flex-1 items-center gap-3.5">
				<Favicon url={link.url} />
				<div className="min-w-0">
					<div className="flex items-center gap-1">
						<RouterLink
							to="/links/$slug"
							params={{ slug: link.slug }}
							search={{ range: '30d' }}
							className="truncate font-semibold decoration-rule underline-offset-4 hover:text-accent hover:underline"
						>
							{shortLabel(link.shortUrl)}
						</RouterLink>
						<CopyButton value={link.shortUrl} />
					</div>
					<p className="truncate text-sm text-mute" title={link.url}>
						{displayUrl(link.url)}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-4 text-sm sm:justify-end">
				<RouterLink
					to="/links/$slug"
					params={{ slug: link.slug }}
					search={{ range: '30d' }}
					className="flex flex-col items-end leading-tight transition-colors hover:text-accent"
				>
					<span className="text-base font-semibold tabular-nums">{link.clicks.toLocaleString('pt-BR')}</span>
					<span className="text-xs text-mute">{link.clicks === 1 ? 'clique' : 'cliques'}</span>
				</RouterLink>
				<span className="hidden w-24 text-right text-mute tabular-nums md:block">
					{link.expiresAt ? `expira ${formatDate(link.expiresAt)}` : formatDate(link.createdAt)}
				</span>
				<div className="flex items-center gap-0.5">
					{confirming ? (
						<>
							<Button
								variant="danger"
								className="h-8 px-2.5"
								onClick={() => remove.mutate()}
								disabled={remove.isPending}
							>
								{remove.isPending ? 'Apagando…' : 'Apagar mesmo'}
							</Button>
							<Button variant="ghost" className="h-8 px-2.5" onClick={() => setConfirming(false)}>
								Manter
							</Button>
						</>
					) : (
						<>
							<Button variant="ghost" className="h-8 px-2.5" onClick={() => setEditing(true)}>
								Editar
							</Button>
							<Button variant="ghost" className="h-8 px-2.5" onClick={() => setConfirming(true)}>
								Apagar
							</Button>
						</>
					)}
				</div>
			</div>
			{remove.error && <ErrorText>{remove.error.message}</ErrorText>}
		</li>
	);
}
