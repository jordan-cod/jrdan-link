import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { api, type Link } from '../api';
import { Button, CopyButton, ErrorText, Input } from '../components/ui';
import { displayUrl, formatDate, shortLabel } from '../format';

const EXPIRY_OPTIONS = [
	{ label: 'Nunca expira', days: 0 },
	{ label: 'Expira em 1 dia', days: 1 },
	{ label: 'Expira em 7 dias', days: 7 },
	{ label: 'Expira em 30 dias', days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function LinksPage() {
	const { data: links, isPending, error } = useQuery({ queryKey: ['links'], queryFn: api.links });
	const [search, setSearch] = useState('');

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!links || !term) return links ?? [];
		return links.filter((link) => link.slug.toLowerCase().includes(term) || link.url.toLowerCase().includes(term));
	}, [links, search]);

	return (
		<div className="mx-auto grid max-w-3xl gap-12">
			<CreateLink />

			<section aria-labelledby="links-title" className="grid gap-4">
				<div className="flex items-end justify-between gap-4">
					<h2 id="links-title" className="font-medium">
						Todos
						{links && <span className="ml-2 font-normal text-mute tabular-nums">{links.length}</span>}
					</h2>
					{links && links.length > 0 && (
						<Input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Buscar"
							aria-label="Buscar links"
							className="h-9 max-w-56"
						/>
					)}
				</div>

				{isPending && <p className="text-mute">Carregando…</p>}
				<ErrorText>{error?.message}</ErrorText>

				{links && links.length === 0 && (
					<p className="rounded-lg border border-dashed border-rule px-4 py-8 text-center text-mute">
						Nenhum link ainda. Cole uma URL acima pra criar o primeiro.
					</p>
				)}

				{links && links.length > 0 && visible.length === 0 && <p className="text-mute">Nenhum link com “{search}”.</p>}

				{visible.length > 0 && (
					<ul className="divide-y divide-rule border-y border-rule">
						{visible.map((link) => (
							<LinkRow key={link.slug} link={link} />
						))}
					</ul>
				)}
			</section>
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
		<section aria-labelledby="create-title">
			<h1 className="text-2xl font-semibold tracking-tight">Links</h1>
			<h2 id="create-title" className="mt-8 font-medium">
				Encurtar um link
			</h2>

			<form onSubmit={submit} className="mt-5 grid gap-3">
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						type="url"
						required
						autoFocus
						value={url}
						onChange={(event) => setUrl(event.target.value)}
						placeholder="https://"
						aria-label="URL de destino"
						className="h-11 text-base"
					/>
					<Button type="submit" variant="primary" className="h-11 px-5" disabled={create.isPending}>
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
					className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-ok/25 bg-ok/6 py-2 pl-4 pr-2"
				>
					<p className="min-w-0 truncate">
						<span className="font-medium">{shortLabel(created.link.shortUrl)}</span>
						<span className="text-mute">{created.copied ? ' criado e copiado.' : ' criado.'}</span>
					</p>
					<CopyButton value={created.link.shortUrl} />
				</div>
			)}
		</section>
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
			<li className="py-4">
				<form
					className="grid gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						update.mutate(draft);
					}}
				>
					<p className="font-medium">{shortLabel(link.shortUrl)}</p>
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
		<li className="group grid gap-1 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
			<div className="min-w-0">
				<div className="flex items-center gap-1">
					<RouterLink
						to="/links/$slug"
						params={{ slug: link.slug }}
						search={{ range: '30d' }}
						className="truncate font-medium decoration-rule underline-offset-4 hover:text-accent hover:underline"
					>
						{shortLabel(link.shortUrl)}
					</RouterLink>
					<CopyButton value={link.shortUrl} />
				</div>
				<p className="truncate text-sm text-mute" title={link.url}>
					{displayUrl(link.url)}
				</p>
			</div>

			<div className="flex items-center gap-3 text-sm sm:justify-end">
				<RouterLink
					to="/links/$slug"
					params={{ slug: link.slug }}
					search={{ range: '30d' }}
					className="tabular-nums text-ink decoration-rule underline-offset-4 hover:text-accent hover:underline"
				>
					{link.clicks === 1 ? '1 clique' : `${link.clicks.toLocaleString('pt-BR')} cliques`}
				</RouterLink>
				<span className="text-mute tabular-nums">
					{link.expiresAt ? `expira ${formatDate(link.expiresAt)}` : formatDate(link.createdAt)}
				</span>
				<div className="flex items-center gap-1">
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
			{remove.error && (
				<div className="sm:col-span-2">
					<ErrorText>{remove.error.message}</ErrorText>
				</div>
			)}
		</li>
	);
}
