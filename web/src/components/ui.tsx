import { type ButtonHTMLAttributes, forwardRef, type InputHTMLAttributes, useEffect, useState } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
	primary: 'bg-ink text-paper hover:bg-ink/85',
	secondary: 'bg-surface text-ink border border-rule hover:border-ink/30 shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
	ghost: 'text-mute hover:text-ink hover:bg-wash',
	danger: 'text-danger hover:bg-danger/8',
};

export function Button({
	variant = 'secondary',
	className = '',
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
	return (
		<button
			type="button"
			className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
			{...props}
		/>
	);
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
	{ className = '', ...props },
	ref,
) {
	return (
		<input
			ref={ref}
			className={`h-10 w-full rounded-lg border border-rule bg-surface px-3 text-[0.9375rem] text-ink placeholder:text-mute/70 transition-colors focus:border-ink/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent ${className}`}
			{...props}
		/>
	);
});

export function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1600);
		return () => clearTimeout(timer);
	}, [copied]);

	return (
		<Button
			variant="ghost"
			className="h-8 px-2.5"
			onClick={async () => {
				await navigator.clipboard.writeText(value);
				setCopied(true);
			}}
			aria-live="polite"
		>
			<span className={copied ? 'text-ok' : undefined}>{copied ? 'Copiado' : label}</span>
		</Button>
	);
}

export function ErrorText({ children }: { children: string | null | undefined }) {
	if (!children) return null;
	return (
		<p role="alert" className="text-sm text-danger">
			{children}
		</p>
	);
}
