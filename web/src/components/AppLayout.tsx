import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouteContext } from '@tanstack/react-router';
import { api } from '../api';

const navClass =
	'rounded-md px-2.5 py-1 text-sm text-mute transition-colors hover:text-ink [&.active]:bg-wash [&.active]:text-ink';

export function AppLayout() {
	const { me } = useRouteContext({ from: '/app' });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	async function signOut() {
		await api.logout();
		queryClient.clear();
		await navigate({ to: '/login', search: { error: undefined } });
	}

	return (
		<div className="mx-auto min-h-screen max-w-6xl px-5 pb-24">
			<header className="flex items-center justify-between gap-4 py-6">
				<div className="flex items-center gap-6">
					<Link to="/" className="text-[0.9375rem] font-semibold tracking-tight">
						jrdan.link
					</Link>
					<nav className="flex items-center gap-1" aria-label="Seções">
						<Link to="/" className={navClass} activeOptions={{ exact: true }}>
							Links
						</Link>
						<Link to="/stats" search={{ range: '30d' }} className={navClass}>
							Cliques
						</Link>
						<Link to="/tokens" className={navClass}>
							Tokens
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-3 text-sm">
					<span className="hidden text-mute sm:inline">{me.login}</span>
					<button type="button" onClick={signOut} className="text-mute transition-colors hover:text-ink">
						Sair
					</button>
				</div>
			</header>
			<main className="pt-6">
				<Outlet />
			</main>
		</div>
	);
}
