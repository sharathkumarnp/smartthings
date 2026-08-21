"use client";

export interface MapPoint {
  latitude: number;
  longitude: number;
  collectedAt?: string;
  state?: string;
}

export interface MapStop {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  placeName?: string | null;
}

export function LocationMap({
  points,
  playbackIndex,
  query,
  className = "map"
}: {
  points: MapPoint[];
  stops?: MapStop[];
  playbackIndex?: number;
  query?: string;
  className?: string;
}) {
  const position = playbackIndex === undefined ? Math.max(0, points.length - 1) : playbackIndex;
  const baseIndex = Math.min(Math.floor(position), Math.max(0, points.length - 1));
  const nextIndex = Math.min(baseIndex + 1, Math.max(0, points.length - 1));
  const fraction = Math.max(0, Math.min(1, position - baseIndex));
  const current = points.length
    ? {
        latitude: points[baseIndex].latitude + (points[nextIndex].latitude - points[baseIndex].latitude) * fraction,
        longitude: points[baseIndex].longitude + (points[nextIndex].longitude - points[baseIndex].longitude) * fraction
      }
    : null;
  const center = points.length
    ? {
        latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
        longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length
      }
    : null;
  const spread = points.length
    ? Math.max(
        Math.max(...points.map((point) => point.latitude)) - Math.min(...points.map((point) => point.latitude)),
        Math.max(...points.map((point) => point.longitude)) - Math.min(...points.map((point) => point.longitude))
      )
    : 0;
  const zoom = spread < 0.005 ? 16 : spread < 0.02 ? 14 : spread < 0.08 ? 12 : spread < 0.3 ? 10 : 8;
  const mapTarget = query || (center ? `${center.latitude},${center.longitude}` : "Bengaluru, Karnataka");
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(mapTarget)}&z=${zoom}&output=embed`;
  const projected = points.map((point) => project(point, points));
  const currentProjected = current ? project(current, points) : null;
  const visiblePath = [...projected.slice(0, baseIndex + 1), ...(currentProjected ? [currentProjected] : [])];

  return (
    <div className={`${className} google-map-frame`}>
      <iframe
        key={src}
        title="Google map showing sampled device location"
        src={src}
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {!query && points.length > 0 && (
        <svg className="google-route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={visiblePath.map((point) => `${point.x},${point.y}`).join(" ")} />
          {projected.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="0.65" />)}
        </svg>
      )}
      {!query && currentProjected && (
        <span
          className="google-playback-marker"
          style={{ left: `${currentProjected.x}%`, top: `${currentProjected.y}%` }}
        />
      )}
      <span className="map-badge">GOOGLE MAPS · SAMPLED DEVICE LOCATION</span>
    </div>
  );
}

function project(point: { latitude: number; longitude: number }, points: MapPoint[]) {
  if (!points.length) return { x: 50, y: 50 };
  const minLat = Math.min(...points.map((item) => item.latitude));
  const maxLat = Math.max(...points.map((item) => item.latitude));
  const minLon = Math.min(...points.map((item) => item.longitude));
  const maxLon = Math.max(...points.map((item) => item.longitude));
  const latSpan = Math.max(maxLat - minLat, 0.0005);
  const lonSpan = Math.max(maxLon - minLon, 0.0005);
  return {
    x: 10 + ((point.longitude - minLon) / lonSpan) * 80,
    y: 90 - ((point.latitude - minLat) / latSpan) * 80
  };
}
