import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ChartIcon, ChevronIcon, LinkIcon, LogoutIcon, SettingsIcon } from './icons';

const navClass =
	'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-mute transition-colors hover:bg-wash hover:text-ink [&.active]:bg-surface [&.active]:text-ink [&.active]:shadow-[0_0_0_1px_var(--color-rule)]';

export function AppLayout() {
	const { me } = useRouteContext({ from: '/app' });

	return (
		<div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
			<aside className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-rule bg-paper/90 px-4 py-3 backdrop-blur md:h-screen md:flex-col md:items-stretch md:justify-start md:border-r md:border-b-0 md:px-3 md:py-5">
				<Link to="/" search={{ range: '30d' }} className="px-2.5 text-[0.9375rem] font-semibold tracking-tight">
					jrdan.link
				</Link>

				<nav className="flex gap-1 md:mt-8 md:flex-col" aria-label="Principal">
					<Link
						to="/"
						search={{ range: '30d' }}
						className={navClass}
						activeOptions={{ exact: true, includeSearch: false }}
					>
						<ChartIcon />
						<span className="hidden sm:inline">Dashboard</span>
					</Link>
					<Link to="/links" className={navClass} activeOptions={{ includeSearch: false }}>
						<LinkIcon />
						<span className="hidden sm:inline">Links</span>
					</Link>
				</nav>

				<UserMenu login={me.login} />
			</aside>

			<main className="min-w-0 px-5 pt-8 pb-24 md:px-10 md:pt-10">
				<div className="mx-auto max-w-6xl">
					<Outlet />
				</div>
			</main>
		</div>
	);
}

function UserMenu({ login }: { login: string }) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!open) return;
		const close = (event: MouseEvent | KeyboardEvent) => {
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open]);

	async function signOut() {
		await api.logout();
		queryClient.clear();
		await navigate({ to: '/login', search: { error: undefined } });
	}

	const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-wash';

	return (
		<div ref={box} className="relative md:mt-auto">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				aria-haspopup="menu"
				className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-sm transition-colors hover:bg-wash md:p-2"
			>
				<img
					src={`https://github.com/${encodeURIComponent(login)}.png?size=64`}
					alt=""
					width={28}
					height={28}
					className="size-7 rounded-full bg-wash"
				/>
				<span className="hidden min-w-0 flex-1 truncate font-medium md:inline">{login}</span>
				<ChevronIcon className={`hidden text-mute transition-transform md:block ${open ? '' : 'rotate-180'}`} />
			</button>

			{open && (
				<div
					role="menu"
					className="absolute right-0 bottom-auto z-30 mt-2 w-52 rounded-xl border border-rule bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] md:right-auto md:bottom-full md:left-0 md:mt-0 md:mb-2 md:w-full"
				>
					<Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
						<SettingsIcon className="text-mute" />
						Configurações
					</Link>
					<button role="menuitem" type="button" className={`${item} text-danger`} onClick={signOut}>
						<LogoutIcon />
						Sair
					</button>
				</div>
			)}
		</div>
	);
}
