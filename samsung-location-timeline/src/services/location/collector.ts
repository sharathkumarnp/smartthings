import { Prisma, type MovementState } from "@prisma/client";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { createLocationProvider } from "@/integrations/provider";
import { SamsungProviderError } from "@/integrations/samsung/errors";
import { effectiveMovementMeters } from "./distance";
import { isDuplicate, isStale, validateSample } from "./validation";
import { classifyMovement, detectStop } from "@/services/stop/detection";
import { findDevice, latestPoint, recentPoints, savePoint } from "@/repositories/locationRepository";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function event(
  type: string,
  severity: "INFO" | "WARNING" | "ERROR",
  message: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.systemEvent.create({ data: { type, severity, message, metadata } });
}

export async function collectLocation() {
  const provider = createLocationProvider();
  const devices = await provider.getDevices();
  const selectedId = config.samsungDeviceId || devices[0]?.providerDeviceId;
  if (!selectedId) throw new Error("No location provider device is available");
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.providerMaxRetries; attempt++) {
    try {
      const sample = validateSample(await provider.getCurrentLocation(selectedId));
      const device = await findDevice(sample.provider, selectedId);
      if (!device) throw new Error("Device is not seeded. Run prisma db seed.");
      const previous = await latestPoint(device.id);
      const previousSample = previous
        ? {
            provider: previous.source,
            deviceId: selectedId,
            latitude: Number(previous.latitude),
            longitude: Number(previous.longitude),
            accuracy: previous.accuracy ?? undefined,
            providerTimestamp: previous.providerTimestamp ?? undefined,
            collectedAt: previous.collectedAt
          }
        : null;
      if (previousSample && isDuplicate(previousSample, sample)) {
        await event("LOCATION_DUPLICATE_SKIPPED", "INFO", "Provider returned the same sampled location.", {
          deviceId: device.id
        });
        return { status: "duplicate" as const };
      }
      const stale = isStale(sample.providerTimestamp, sample.collectedAt, config.staleMinutes);
      const state: MovementState = stale ? "STALE" : classifyMovement(previousSample, sample);
      const distance = previousSample ? effectiveMovementMeters(previousSample, sample) : null;
      const elapsedSeconds = previousSample
        ? (sample.collectedAt.getTime() - previousSample.collectedAt.getTime()) / 1000
        : 0;
      const speed = distance !== null && elapsedSeconds > 0 ? distance / elapsedSeconds : null;
      const point = await savePoint(device.id, sample, state, distance, speed);
      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: sample.collectedAt, movementState: state }
      });
      await event(
        stale ? "STALE_LOCATION_RECEIVED" : "LOCATION_COLLECTION_SUCCESS",
        stale ? "WARNING" : "INFO",
        stale ? "Provider returned an old location." : "Location sample stored.",
        { deviceId: device.id, pointId: point.id }
      );
      await processTrip(device.id, state, sample, distance ?? 0);
      const recent = await recentPoints(device.id, 12);
      const stop = detectStop(
        recent.map((item) => ({
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          accuracy: item.accuracy,
          timestamp: item.providerTimestamp ?? item.collectedAt
        })),
        config.stopRadiusMeters,
        config.stopMinDurationMinutes
      );
      if (stop) {
        const existing = await prisma.stop.findFirst({
          where: { deviceId: device.id, endedAt: null },
          orderBy: { startedAt: "desc" }
        });
        if (existing)
          await prisma.stop.update({
            where: { id: existing.id },
            data: {
              endedAt: stop.endedAt,
              durationSeconds: stop.durationSeconds,
              latitude: stop.latitude,
              longitude: stop.longitude,
              radiusMeters: stop.radiusMeters
            }
          });
        else {
          await prisma.stop.create({ data: { deviceId: device.id, ...stop } });
          const latitudeKey = stop.latitude.toFixed(4);
          const longitudeKey = stop.longitude.toFixed(4);
          await prisma.geocodedPlace.upsert({
            where: { deviceId_latitudeKey_longitudeKey: { deviceId: device.id, latitudeKey, longitudeKey } },
            update: {
              visitCount: { increment: 1 },
              lastVisitedAt: stop.endedAt,
              latitude: stop.latitude,
              longitude: stop.longitude
            },
            create: {
              deviceId: device.id,
              latitudeKey,
              longitudeKey,
              latitude: stop.latitude,
              longitude: stop.longitude,
              name: "Unknown place",
              lastVisitedAt: stop.endedAt
            }
          });
          await event("STOP_DETECTED", "INFO", "A stationary period was detected.", { deviceId: device.id });
        }
      }
      return { status: "stored" as const, pointId: point.id, state };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof SamsungProviderError && error.retryable;
      if (!retryable || attempt === config.providerMaxRetries) break;
      const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 750);
      logger.warn({ attempt: attempt + 1, delay, code: error.code }, "Provider call failed; retrying");
      await wait(delay);
    }
  }
  const authRequired = lastError instanceof SamsungProviderError && lastError.code === "AUTH_REQUIRED";
  await event(
    authRequired ? "SAMSUNG_AUTH_EXPIRED" : "LOCATION_COLLECTION_FAILED",
    "ERROR",
    lastError instanceof Error ? lastError.message : "Location collection failed"
  );
  throw lastError;
}

async function processTrip(
  deviceId: string,
  state: MovementState,
  sample: { latitude: number; longitude: number; collectedAt: Date },
  distanceMeters: number
) {
  const active = await prisma.trip.findFirst({
    where: { deviceId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" }
  });
  if (state === "MOVING" && !active) {
    await prisma.trip.create({
      data: {
        deviceId,
        startedAt: sample.collectedAt,
        startLatitude: sample.latitude,
        startLongitude: sample.longitude,
        endLatitude: sample.latitude,
        endLongitude: sample.longitude,
        distanceMeters,
        status: "ACTIVE"
      }
    });
    await event("TRIP_STARTED", "INFO", "Movement began a candidate trip.", { deviceId });
    return;
  }
  if (!active) return;
  const total = active.distanceMeters + distanceMeters;
  const durationSeconds = Math.max(
    0,
    Math.floor((sample.collectedAt.getTime() - active.startedAt.getTime()) / 1000)
  );
  if (state === "MOVING") {
    await prisma.trip.update({
      where: { id: active.id },
      data: {
        endLatitude: sample.latitude,
        endLongitude: sample.longitude,
        distanceMeters: total,
        durationSeconds
      }
    });
    return;
  }
  if (state === "STOPPED") {
    const completed = total >= config.tripMinDistanceMeters;
    await prisma.trip.update({
      where: { id: active.id },
      data: {
        endedAt: sample.collectedAt,
        endLatitude: sample.latitude,
        endLongitude: sample.longitude,
        distanceMeters: total,
        durationSeconds,
        status: completed ? "COMPLETED" : "DISCARDED"
      }
    });
    if (completed)
      await event("TRIP_COMPLETED", "INFO", "A sampled trip was completed.", { deviceId, tripId: active.id });
  }
}
