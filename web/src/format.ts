const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(iso: string): string {
	const parts = dateFormat.formatToParts(new Date(iso));
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
	return `${part('day')} ${part('month').replace('.', '')} ${part('year')}`;
}

export function displayUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const path = `${parsed.pathname}${parsed.search}`;
		return `${parsed.host}${path === '/' ? '' : path}`;
	} catch {
		return url;
	}
}

export const shortLabel = (shortUrl: string) => shortUrl.replace(/^https?:\/\//, '');
