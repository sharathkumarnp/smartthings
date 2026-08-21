import type { Coordinate } from "@/types/location";
import { effectiveMovementMeters, haversineMeters } from "@/services/location/distance";

export interface DetectedStop {
  latitude: number;
  longitude: number;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  radiusMeters: number;
}

export function detectStop(
  points: Coordinate[],
  radiusMeters: number,
  minimumMinutes: number
): DetectedStop | null {
  if (points.length < 2 || points.some((point) => !point.timestamp)) return null;
  const first = points[0];
  const last = points.at(-1)!;
  const duration = last.timestamp!.getTime() - first.timestamp!.getTime();
  if (duration < minimumMinutes * 60_000) return null;
  const latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  const center = { latitude, longitude };
  const distances = points.map((point) => haversineMeters(center, point));
  const effectiveDistances = points.map((point) => effectiveMovementMeters(center, point));
  if (Math.max(...effectiveDistances) > radiusMeters) return null;
  return {
    latitude,
    longitude,
    startedAt: first.timestamp!,
    endedAt: last.timestamp!,
    durationSeconds: Math.floor(duration / 1000),
    radiusMeters: Math.max(...distances)
  };
}

export function classifyMovement(
  previous: Coordinate | null,
  current: Coordinate,
  thresholdMeters = 35
): "MOVING" | "STOPPED" | "UNKNOWN" {
  if (!previous) return "UNKNOWN";
  return effectiveMovementMeters(previous, current) >= thresholdMeters ? "MOVING" : "STOPPED";
}
