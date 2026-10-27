import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouteContext } from '@tanstack/react-router';
import { api } from '../api';
import { Card } from '../components/Card';
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
		<div className="mx-auto grid max-w-4xl gap-6">
			<header>
				<h1 className="text-[1.75rem] font-semibold tracking-tight">Configurações</h1>
				<p className="mt-1 text-mute">Sua conta e os tokens de acesso dos scripts.</p>
			</header>

			<Card title="Conta">
				<div className="flex flex-wrap items-center justify-between gap-4">
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
			</Card>

			<TokensSection />
		</div>
	);
}
