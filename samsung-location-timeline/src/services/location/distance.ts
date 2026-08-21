import type { Coordinate } from "@/types/location";

const EARTH_RADIUS_METERS = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineMeters(a: Coordinate, b: Coordinate): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function effectiveMovementMeters(a: Coordinate, b: Coordinate): number {
  const raw = haversineMeters(a, b);
  const uncertainty = Math.max(a.accuracy ?? 0, b.accuracy ?? 0);
  return Math.max(0, raw - uncertainty);
}
