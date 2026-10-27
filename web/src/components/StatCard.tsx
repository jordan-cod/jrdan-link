import type { ReactNode } from 'react';
import { formatNumber } from '../stats/scale';

interface StatCardProps {
	label: string;
	value: string;
	detail?: ReactNode;
	visual?: ReactNode;
}

export function StatCard({ label, value, detail, visual }: StatCardProps) {
	return (
		<div className="flex min-w-0 flex-col rounded-2xl border border-rule bg-surface p-5 shadow-card">
			<div className="flex h-9 items-start justify-between gap-3">
				<p className="text-sm font-medium text-mute">{label}</p>
				{visual && <div className="-mt-1 shrink-0">{visual}</div>}
			</div>
			<p className="mt-1 truncate text-[2rem] leading-none font-semibold tracking-tight">{value}</p>
			{detail && <div className="mt-3 text-sm text-mute">{detail}</div>}
		</div>
	);
}

export function Delta({ current, previous, period }: { current: number; previous: number | null; period: string }) {
	if (previous === null) return <span>Desde o primeiro clique</span>;
	if (previous === 0) {
		return (
			<span>{current > 0 ? `Nenhum clique nos ${period} anteriores` : `Sem cliques nos ${period} anteriores`}</span>
		);
	}

	const change = (current - previous) / previous;
	const up = change >= 0;
	const label = `${up ? '+' : '−'}${formatNumber(Math.round(Math.abs(change) * 100))}%`;

	return (
		<span className="flex flex-wrap items-center gap-1.5">
			<span
				className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
					up ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
				}`}
			>
				<svg viewBox="0 0 12 12" width={10} height={10} aria-hidden="true" className={up ? '' : 'rotate-180'}>
					<path d="M6 2.5 10 8H2Z" fill="currentColor" />
				</svg>
				{label}
			</span>
			<span>vs {period} anteriores</span>
		</span>
	);
}
