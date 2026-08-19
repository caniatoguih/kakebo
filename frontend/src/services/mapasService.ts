import { api } from './api';

export interface Coordinates { latitude: number; longitude: number; }
export interface LocationResult extends Coordinates { label: string; houseNumber?: string | null; }
export interface RouteResult { distanceKm: number; durationMinutes: number; geometry: { type: 'LineString'; coordinates: number[][] }; provider: 'osrm'; }

export const mapasService = {
  geocodificar: async (query: string): Promise<LocationResult[]> => (await api.get('/maps/geocode', { params: { q: query } })).data.items,
  calcularRota: async (origin: Coordinates, destination: Coordinates): Promise<RouteResult> => (await api.post('/maps/routes', { origin, destination, profile: 'car' })).data,
};
