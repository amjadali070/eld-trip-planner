import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STOP_ICONS = {
  pre_trip_inspection: { color: '#10B981', emoji: '🟢', label: 'Start' },
  pickup: { color: '#3B82F6', emoji: '📦', label: 'Pickup' },
  dropoff: { color: '#EF4444', emoji: '🏁', label: 'Dropoff' },
  fuel_stop: { color: '#F59E0B', emoji: '⛽', label: 'Fuel Stop' },
  rest_break: { color: '#8B5CF6', emoji: '☕', label: 'Rest Break' },
  rest: { color: '#6366F1', emoji: '🛏️', label: 'Rest (10hr)' },
  cycle_restart: { color: '#EC4899', emoji: '🔄', label: '34hr Restart' },
};

function createIcon(stopType) {
  const cfg = STOP_ICONS[stopType] || STOP_ICONS.rest;
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${cfg.color};
      width:32px;height:32px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);">
      ${cfg.emoji}
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function FitBounds({ stops }) {
  const map = useMap();
  useEffect(() => {
    if (!stops || stops.length === 0) return;
    const latlngs = stops
      .filter(s => s.location?.lat && s.location?.lon)
      .map(s => [s.location.lat, s.location.lon]);
    if (latlngs.length > 0) {
      map.fitBounds(latlngs, { padding: [40, 40], animate: false });
    }
  }, [stops, map]);
  return null;
}

export default function MapView({ tripData }) {
  if (!tripData) return null;

  const { route, stops } = tripData;
  const geometry = route?.geometry;

  // Convert GeoJSON LineString to Leaflet format [[lat, lon], ...]
  const polylinePoints = geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];

  // Center map on first waypoint
  const center = route?.waypoints?.[0]
    ? [route.waypoints[0].lat, route.waypoints[0].lon]
    : [39.5, -98.35]; // US center

  const mapStops = stops?.filter(s => s.location?.lat) || [];

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-700">
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route polyline */}
        {polylinePoints.length > 0 && (
          <Polyline
            positions={polylinePoints}
            color="#F59E0B"
            weight={4}
            opacity={0.85}
            dashArray="8 4"
          />
        )}

        {/* Stop markers */}
        {mapStops.map((stop) => (
          <Marker
            key={stop.stop_id}
            position={[stop.location.lat, stop.location.lon]}
            icon={createIcon(stop.stop_type)}
          >
            <Popup>
              <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', minWidth: '180px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1A2E4A', marginBottom: '6px' }}>
                  {STOP_ICONS[stop.stop_type]?.emoji} {STOP_ICONS[stop.stop_type]?.label}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  📍 {stop.location.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  <div>Day {stop.day}</div>
                  <div>Arrive: {new Date(stop.arrive_time).toUTCString().slice(5, 22)}</div>
                  <div>Depart: {new Date(stop.depart_time).toUTCString().slice(5, 22)}</div>
                  <div style={{ marginTop: '4px', color: '#F59E0B', fontWeight: 600 }}>
                    Duration: {(stop.duration_hours * 60).toFixed(0)} min
                  </div>
                </div>
                {stop.notes && (
                  <div style={{ fontSize: '11px', color: '#0F172A', marginTop: '4px', fontStyle: 'italic' }}>
                    {stop.notes}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds stops={mapStops} />
      </MapContainer>
    </div>
  );
}
