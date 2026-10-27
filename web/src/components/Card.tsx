import type { ReactNode } from 'react';

interface CardProps {
	title?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
}

export function Card({ title, action, children, className = '', bodyClassName = 'p-5' }: CardProps) {
	return (
		<section className={`min-w-0 rounded-2xl border border-rule bg-surface shadow-card ${className}`}>
			{(title || action) && (
				<header className="flex min-h-14 items-center justify-between gap-3 border-b border-rule px-5 py-3">
					<div className="min-w-0 text-[0.9375rem] font-semibold tracking-tight">{title}</div>
					{action}
				</header>
			)}
			<div className={bodyClassName}>{children}</div>
		</section>
	);
}
