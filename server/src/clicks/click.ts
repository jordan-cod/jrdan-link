export interface Click {
	id: string;
	slug: string;
	at: Date;
	country: string;
	regionCode: string;
	region: string;
	city: string;
	latitude: number | null;
	longitude: number | null;
	referrer: string;
	device: string;
	weight: number;
}

export interface ClickSource {
	since(from: Date, limit: number): Promise<Click[]>;
}
