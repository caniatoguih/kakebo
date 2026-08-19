import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LocationResult, RouteResult } from '@/services/mapasService';
import 'leaflet/dist/leaflet.css';

function FitBounds({ origin, destination }: { origin: LocationResult; destination: LocationResult }) {
  const map = useMap();
  useEffect(() => { map.fitBounds([[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]], { padding: [28, 28] }); }, [map, origin, destination]);
  return null;
}
const positions = (route: RouteResult) => route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);

export function MapaTrajeto({ origin, destination, outbound, returnRoute, onOriginChange, onDestinationChange }: { origin: LocationResult; destination: LocationResult; outbound?: RouteResult; returnRoute?: RouteResult; onOriginChange?: (location: LocationResult) => void; onDestinationChange?: (location: LocationResult) => void }) {
  return <div className="h-80 overflow-hidden rounded-xl border"><MapContainer center={[origin.latitude, origin.longitude]} zoom={13} className="h-full w-full" scrollWheelZoom>
    <TileLayer attribution="&copy; OpenStreetMap contributors &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
    <Marker position={[origin.latitude, origin.longitude]} draggable={Boolean(onOriginChange)} eventHandlers={{ dragend: (event) => { const position = event.target.getLatLng(); onOriginChange?.({ ...origin, label: 'Origem ajustada no mapa', latitude: position.lat, longitude: position.lng }); } }} />
    <Marker position={[destination.latitude, destination.longitude]} draggable={Boolean(onDestinationChange)} eventHandlers={{ dragend: (event) => { const position = event.target.getLatLng(); onDestinationChange?.({ ...destination, label: 'Destino ajustado no mapa', latitude: position.lat, longitude: position.lng }); } }} />
    {outbound && <Polyline positions={positions(outbound)} pathOptions={{ color: '#059669', weight: 5 }} />}
    {returnRoute && <Polyline positions={positions(returnRoute)} pathOptions={{ color: '#d97706', weight: 5, dashArray: '8 10' }} />}
    <FitBounds origin={origin} destination={destination} />
  </MapContainer></div>;
}
