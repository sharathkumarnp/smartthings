import { z } from "zod";
import type { LocationSample } from "@/types/location";

const sampleSchema = z.object({
  provider: z.enum(["samsung", "mock"]),
  deviceId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().max(100_000).optional(),
  providerTimestamp: z.date().optional(),
  collectedAt: z.date(),
  rawStatus: z.string().max(200).optional()
});

export function validateSample(sample: LocationSample): LocationSample {
  return sampleSchema.parse(sample);
}

export function isStale(providerTimestamp: Date | undefined, now: Date, thresholdMinutes: number): boolean {
  return !providerTimestamp || now.getTime() - providerTimestamp.getTime() > thresholdMinutes * 60_000;
}

export function isDuplicate(a: LocationSample, b: LocationSample): boolean {
  if (a.deviceId !== b.deviceId) return false;
  if (a.providerTimestamp && b.providerTimestamp)
    return (
      a.providerTimestamp.getTime() === b.providerTimestamp.getTime() &&
      a.latitude === b.latitude &&
      a.longitude === b.longitude
    );
  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    Math.abs(a.collectedAt.getTime() - b.collectedAt.getTime()) < 60_000
  );
}
