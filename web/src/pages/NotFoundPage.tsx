import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
	return (
		<main className="grid min-h-[60vh] place-items-center px-5">
			<div className="text-center">
				<p className="text-sm text-mute">404</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Essa página não existe</h1>
				<Link
					to="/"
					search={{ range: '30d' }}
					className="mt-6 inline-block text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
				>
					Voltar pro dashboard
				</Link>
			</div>
		</main>
	);
}
