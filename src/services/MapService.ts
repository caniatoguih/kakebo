export interface Coordinates { latitude: number; longitude: number; }
export interface LocationResult extends Coordinates { label: string; houseNumber?: string | null; }
export interface RouteGeometry { type: 'LineString'; coordinates: number[][]; }
export interface RouteResult { distanceKm: number; durationMinutes: number; geometry: RouteGeometry; provider: 'osrm'; }

export class ExternalServiceError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

async function externalFetch(url: string, init: RequestInit, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new ExternalServiceError('Não foi possível consultar o serviço de mapas.', response.status === 429 ? 429 : 502);
    return response;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError('O serviço de mapas está indisponível no momento.');
  } finally { clearTimeout(timer); }
}

export interface GeocodingProvider { search(query: string): Promise<LocationResult[]>; }
const geocodeCache = new Map<string, { items: LocationResult[]; expiresAt: number }>();
export class NominatimGeocodingProvider implements GeocodingProvider {
  constructor(private readonly baseUrl = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org') {}
  async search(query: string) {
    const cacheKey = `${this.baseUrl}|${query.trim().toLowerCase()}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.items;
    const url = new URL('/search', this.baseUrl);
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', addressdetails: '1', countrycodes: 'br' }).toString();
    const response = await externalFetch(url.toString(), { headers: { Accept: 'application/json', 'User-Agent': process.env.NOMINATIM_USER_AGENT ?? 'Kakebo/1.0' } });
    const items = await response.json() as Array<{ display_name?: string; lat?: string; lon?: string; address?: { house_number?: string } }>;
    const requestedNumber = query.match(/(?:^|[,\s])(\d{1,6})(?:$|[,\s])/i)?.[1];
    const locations = items.flatMap((item) => {
      const latitude = Number(item.lat); const longitude = Number(item.lon);
      const houseNumber = item.address?.house_number ?? null;
      const label = houseNumber && item.display_name && !item.display_name.includes(houseNumber) ? `${houseNumber}, ${item.display_name}` : item.display_name;
      return label && Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ label, latitude, longitude, houseNumber }] : [];
    });
    const sorted = locations.sort((a, b) => Number(b.houseNumber === requestedNumber) - Number(a.houseNumber === requestedNumber));
    geocodeCache.set(cacheKey, { items: sorted, expiresAt: Date.now() + 10 * 60 * 1000 });
    return sorted;
  }
}

export interface RouteProvider { calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult>; }
export class OsrmRouteProvider implements RouteProvider {
  constructor(private readonly baseUrl = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org') {}
  async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = new URL(`/route/v1/driving/${coordinates}`, this.baseUrl);
    url.search = new URLSearchParams({ overview: 'full', geometries: 'geojson', alternatives: 'false' }).toString();
    const payload = await (await externalFetch(url.toString(), { headers: { Accept: 'application/json' } })).json() as { code?: string; routes?: Array<{ distance?: number; duration?: number; geometry?: RouteGeometry }> };
    const route = payload.routes?.[0];
    if (payload.code !== 'Ok' || !route?.geometry || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new ExternalServiceError('Não foi encontrada uma rota para os pontos informados.', 404);
    return { distanceKm: route.distance! / 1000, durationMinutes: route.duration! / 60, geometry: route.geometry, provider: 'osrm' };
  }
}
