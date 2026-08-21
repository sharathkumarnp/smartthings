import type { Coordinate } from "@/types/location";
import { effectiveMovementMeters } from "@/services/location/distance";

export interface TripSummary {
  startedAt: Date;
  endedAt: Date;
  start: Coordinate;
  end: Coordinate;
  distanceMeters: number;
  durationSeconds: number;
}

export function summarizeTrip(points: Coordinate[], minimumDistanceMeters: number): TripSummary | null {
  if (points.length < 2 || !points[0].timestamp || !points.at(-1)!.timestamp) return null;
  let distanceMeters = 0;
  for (let index = 1; index < points.length; index++)
    distanceMeters += effectiveMovementMeters(points[index - 1], points[index]);
  if (distanceMeters < minimumDistanceMeters) return null;
  const start = points[0];
  const end = points.at(-1)!;
  return {
    startedAt: start.timestamp!,
    endedAt: end.timestamp!,
    start,
    end,
    distanceMeters,
    durationSeconds: Math.floor((end.timestamp!.getTime() - start.timestamp!.getTime()) / 1000)
  };
}
