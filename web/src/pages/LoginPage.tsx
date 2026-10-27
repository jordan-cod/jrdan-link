import { useSearch } from '@tanstack/react-router';

const MESSAGES: Record<string, string> = {
	denied: 'Essa conta do GitHub não tem acesso a este painel.',
	github: 'O GitHub não confirmou o login. Tente de novo.',
	state: 'O login expirou no meio do caminho. Tente de novo.',
};

export function LoginPage() {
	const { error } = useSearch({ from: '/login' });
	const message = error ? (MESSAGES[error] ?? MESSAGES.github) : null;

	return (
		<main className="grid min-h-screen place-items-center px-5">
			<div className="w-full max-w-sm">
				<h1 className="text-3xl font-semibold tracking-tight">jrdan.link</h1>
				<p className="mt-2 text-mute">Painel dos links curtos.</p>

				<a
					href="/auth/github"
					className="mt-8 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-ink text-sm font-medium text-paper transition-colors hover:bg-ink/85"
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
						<path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
					</svg>
					Entrar com GitHub
				</a>

				{message && (
					<p role="alert" className="mt-4 text-sm text-danger">
						{message}
					</p>
				)}
			</div>
		</main>
	);
}
