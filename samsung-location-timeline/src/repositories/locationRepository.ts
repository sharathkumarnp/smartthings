import { Prisma, type MovementState } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { LocationSample } from "@/types/location";

export async function findDevice(provider: "mock" | "samsung", providerDeviceId: string) {
  return prisma.device.findUnique({ where: { provider_providerDeviceId: { provider, providerDeviceId } } });
}

export async function latestPoint(deviceId: string) {
  return prisma.locationPoint.findFirst({ where: { deviceId }, orderBy: { collectedAt: "desc" } });
}

export async function recentPoints(deviceId: string, take = 12) {
  const points = await prisma.locationPoint.findMany({
    where: { deviceId },
    orderBy: { collectedAt: "desc" },
    take
  });
  return points.reverse();
}

export async function savePoint(
  deviceId: string,
  sample: LocationSample,
  state: MovementState,
  distance: number | null,
  speed: number | null
) {
  return prisma.locationPoint.create({
    data: {
      deviceId,
      latitude: new Prisma.Decimal(sample.latitude),
      longitude: new Prisma.Decimal(sample.longitude),
      accuracy: sample.accuracy,
      providerTimestamp: sample.providerTimestamp,
      collectedAt: sample.collectedAt,
      source: sample.provider,
      state,
      distanceFromPrevious: distance,
      speedEstimate: speed,
      rawStatus: sample.rawStatus
    }
  });
}

export async function pointsForRange(userId: string, start: Date, end: Date) {
  return prisma.locationPoint.findMany({
    where: { device: { userId }, collectedAt: { gte: start, lt: end } },
    orderBy: { collectedAt: "asc" },
    include: { device: { select: { deviceName: true } } }
  });
}
