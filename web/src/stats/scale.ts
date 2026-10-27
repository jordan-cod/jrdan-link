export const EMPTY_FILL = '#e3e6ea';
export const RAMP = ['#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'] as const;
export const BAR_FILL = '#3987e5';
export const LINE_STROKE = '#256abf';

export interface ColorScale {
	color(value: number): string;
	classes: { from: number; to: number; color: string }[];
}

export function colorScale(values: number[]): ColorScale {
	const max = Math.max(0, ...values);
	const cuts = [...new Set([1, 0.12, 0.3, 0.55, 0.8].map((share, i) => (i === 0 ? 1 : Math.ceil(max * share))))]
		.filter((cut) => cut <= max)
		.sort((a, b) => a - b);

	const classes = cuts.map((from, i) => ({
		from,
		to: (cuts[i + 1] ?? max + 1) - 1,
		color: RAMP[Math.round((i / Math.max(1, cuts.length - 1)) * (RAMP.length - 1))] ?? RAMP[0],
	}));

	return {
		classes,
		color(value) {
			if (value <= 0) return EMPTY_FILL;
			for (let i = classes.length - 1; i >= 0; i--) {
				const step = classes[i];
				if (step && value >= step.from) return step.color;
			}
			return RAMP[0];
		},
	};
}

const numberFormat = new Intl.NumberFormat('pt-BR');
export const formatNumber = (value: number) => numberFormat.format(value);

export const clicksLabel = (value: number) => `${formatNumber(value)} ${value === 1 ? 'clique' : 'cliques'}`;

const regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
export function countryName(code: string, fallback?: string): string {
	if (!code) return 'Sem localização';
	if (fallback) return fallback;
	try {
		return regionNames.of(code) ?? code;
	} catch {
		return code;
	}
}

const DEVICE_NAMES: Record<string, string> = {
	mobile: 'Celular',
	desktop: 'Computador',
	tablet: 'Tablet',
};
export const deviceName = (device: string) => DEVICE_NAMES[device] ?? 'Outro';

export const referrerName = (host: string) => host || 'Direto ou sem origem';
