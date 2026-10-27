import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouteContext } from '@tanstack/react-router';
import { api } from '../api';
import { LogoutIcon } from '../components/icons';
import { Button } from '../components/ui';
import { TokensSection } from './TokensSection';

export function SettingsPage() {
	const { me } = useRouteContext({ from: '/app' });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	async function signOut() {
		await api.logout();
		queryClient.clear();
		await navigate({ to: '/login', search: { error: undefined } });
	}

	return (
		<div className="mx-auto grid max-w-3xl gap-12">
			<h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>

			<section aria-labelledby="account-title" className="grid gap-4">
				<h2 id="account-title" className="text-lg font-semibold tracking-tight">
					Conta
				</h2>
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-surface p-4">
					<div className="flex items-center gap-3">
						<img
							src={`https://github.com/${encodeURIComponent(me.login)}.png?size=96`}
							alt=""
							width={40}
							height={40}
							className="size-10 rounded-full bg-wash"
						/>
						<div>
							<p className="font-medium">{me.login}</p>
							<p className="text-sm text-mute">Entrou com GitHub</p>
						</div>
					</div>
					<Button variant="danger" onClick={signOut}>
						<LogoutIcon width={16} height={16} />
						Sair
					</Button>
				</div>
			</section>

			<TokensSection />
		</div>
	);
}
