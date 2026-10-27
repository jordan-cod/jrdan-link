import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export interface Place {
	id: string;
	name: string;
}

export type PlaceFeature = Feature<Geometry, Place>;

async function load(url: string): Promise<PlaceFeature[] | null> {
	const response = await fetch(url);
	if (!response.ok) return null;
	const topology = (await response.json()) as Topology;
	const object = Object.values(topology.objects)[0] as GeometryCollection<Place> | undefined;
	if (!object) return null;
	return (feature(topology, object) as FeatureCollection<Geometry, Place>).features;
}

export const loadWorld = async () => (await load('/geo/world.json')) ?? [];

export const loadRegions = (country: string) =>
	/^[A-Z]{2}$/.test(country) ? load(`/geo/admin1/${country}.json`) : Promise.resolve(null);

export const regionCodeOf = (feature: PlaceFeature) => feature.properties.id.split('-').slice(1).join('-');
