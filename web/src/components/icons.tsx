import type { SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			width={18}
			height={18}
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{children}
		</svg>
	);
}

export const ChartIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
	</Icon>
);

export const LinkIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
		<path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
	</Icon>
);

export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
	</Icon>
);

export const LogoutIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
	</Icon>
);

export const ChevronIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<path d="m7 15 5-5 5 5" />
	</Icon>
);

export const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<path d="M19 12H5M12 19l-7-7 7-7" />
	</Icon>
);

export const ExternalIcon = (props: SVGProps<SVGSVGElement>) => (
	<Icon {...props}>
		<path d="M14 4h6v6M10 14 20 4M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
	</Icon>
);
