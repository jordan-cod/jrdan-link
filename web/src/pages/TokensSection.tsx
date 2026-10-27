import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { type ApiToken, api } from '../api';
import { Button, CopyButton, ErrorText, Input } from '../components/ui';
import { formatDate } from '../format';

export function TokensSection() {
	const queryClient = useQueryClient();
	const { data: tokens, isPending, error } = useQuery({ queryKey: ['tokens'], queryFn: api.tokens });
	const [name, setName] = useState('');
	const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);

	const create = useMutation({
		mutationFn: api.createToken,
		onSuccess: async (result) => {
			setSecret({ name: result.token.name, value: result.secret });
			setName('');
			await queryClient.invalidateQueries({ queryKey: ['tokens'] });
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		create.mutate(name);
	}

	return (
		<div className="grid gap-10">
			<section aria-labelledby="tokens-title">
				<h2 id="tokens-title" className="text-lg font-semibold tracking-tight">
					Tokens de acesso
				</h2>
				<p className="mt-2 max-w-prose text-mute">
					Um token deixa um script criar links sem passar pelo login, como o atalho do Mac. Mande no header{' '}
					<code className="rounded bg-wash px-1.5 py-0.5 text-[0.8125rem] text-ink">Authorization: Bearer</code>.
				</p>

				<form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
					<Input
						required
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Nome, ex: Atalho do Mac"
						aria-label="Nome do token"
						maxLength={80}
					/>
					<Button type="submit" variant="primary" disabled={create.isPending} className="h-10 shrink-0">
						Gerar token
					</Button>
				</form>
				<ErrorText>{create.error?.message}</ErrorText>

				{secret && (
					<div role="status" className="mt-4 grid gap-2 rounded-lg border border-rule bg-surface p-4">
						<p className="text-sm">
							<span className="font-medium">{secret.name}</span>
							<span className="text-mute"> criado. Copie agora: ele não aparece de novo.</span>
						</p>
						<div className="flex items-center gap-2 rounded-md bg-wash py-1 pl-3 pr-1">
							<code className="min-w-0 flex-1 truncate text-[0.8125rem]">{secret.value}</code>
							<CopyButton value={secret.value} />
						</div>
					</div>
				)}
			</section>

			<section aria-labelledby="active-title" className="grid gap-4">
				<h3 id="active-title" className="font-medium">
					Ativos
				</h3>
				{isPending && <p className="text-mute">Carregando…</p>}
				<ErrorText>{error?.message}</ErrorText>
				{tokens && tokens.length === 0 && <p className="text-mute">Nenhum token ativo.</p>}
				{tokens && tokens.length > 0 && (
					<ul className="divide-y divide-rule border-y border-rule">
						{tokens.map((token) => (
							<TokenRow key={token.id} token={token} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function TokenRow({ token }: { token: ApiToken }) {
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const revoke = useMutation({
		mutationFn: () => api.revokeToken(token.id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tokens'] }),
	});

	return (
		<li className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p className="font-medium">{token.name}</p>
				<p className="text-sm text-mute">
					Criado em {formatDate(token.createdAt)}
					{token.lastUsedAt ? `, usado pela última vez em ${formatDate(token.lastUsedAt)}` : ', nunca usado'}
				</p>
				<ErrorText>{revoke.error?.message}</ErrorText>
			</div>
			<div className="flex gap-1">
				{confirming ? (
					<>
						<Button variant="danger" className="h-8 px-2.5" onClick={() => revoke.mutate()} disabled={revoke.isPending}>
							Revogar mesmo
						</Button>
						<Button variant="ghost" className="h-8 px-2.5" onClick={() => setConfirming(false)}>
							Manter
						</Button>
					</>
				) : (
					<Button variant="ghost" className="h-8 px-2.5" onClick={() => setConfirming(true)}>
						Revogar
					</Button>
				)}
			</div>
		</li>
	);
}
