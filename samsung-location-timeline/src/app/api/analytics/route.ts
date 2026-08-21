import { NextResponse } from "next/server";
import { startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const period = new URL(request.url).searchParams.get("period") || "today";
  const now = new Date();
  const starts = {
    today: startOfDay(now),
    week: startOfWeek(now),
    month: startOfMonth(now),
    year: startOfYear(now)
  };
  const start = starts[period as keyof typeof starts] ?? starts.today;
  const [points, stops, trips, places, samsungSnapshots] = await Promise.all([
    prisma.locationPoint.findMany({
      where: { device: { user: { email: session.email } }, collectedAt: { gte: start } },
      select: { distanceFromPrevious: true, state: true, collectedAt: true }
    }),
    prisma.stop.findMany({
      where: { device: { user: { email: session.email } }, startedAt: { gte: start } }
    }),
    prisma.trip.findMany({
      where: { device: { user: { email: session.email } }, startedAt: { gte: start } }
    }),
    prisma.geocodedPlace.findMany({
      where: { device: { user: { email: session.email } } },
      orderBy: { visitCount: "desc" },
      take: 1
    }),
    prisma.samsungFindSnapshot.findMany({
      where: {
        device: { user: { email: session.email } },
        capturedAt: { gte: start }
      },
      include: { device: { select: { deviceName: true } } },
      orderBy: { capturedAt: "desc" }
    })
  ]);
  const distanceMeters = points.reduce((sum, point) => sum + (point.distanceFromPrevious ?? 0), 0);
  const movingSeconds = points.filter((point) => point.state === "MOVING").length * configIntervalSeconds();
  const stationarySeconds = stops.reduce((sum, stop) => sum + stop.durationSeconds, 0);
  const latestByDevice = new Map<string, (typeof samsungSnapshots)[number]>();
  const addressCounts = new Map<string, number>();
  for (const snapshot of samsungSnapshots) {
    if (!latestByDevice.has(snapshot.deviceId)) latestByDevice.set(snapshot.deviceId, snapshot);
    if (snapshot.address) addressCounts.set(snapshot.address, (addressCounts.get(snapshot.address) || 0) + 1);
  }
  const mostSeenAddress = [...addressCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const latestDevices = [...latestByDevice.values()];
  return NextResponse.json({
    period,
    approximate: true,
    distanceMeters,
    tripCount: trips.length,
    placesVisited: stops.length,
    movingSeconds,
    stationarySeconds,
    longestTripMeters: Math.max(0, ...trips.map((trip) => trip.distanceMeters)),
    mostVisitedPlace: mostSeenAddress ?? places[0]?.name ?? null,
    samsung: {
      snapshotCount: samsungSnapshots.length,
      deviceCount: latestDevices.length,
      locatedDeviceCount: latestDevices.filter((snapshot) => Boolean(snapshot.address)).length,
      unavailableDeviceCount: latestDevices.filter((snapshot) => !snapshot.address).length,
      uniqueAddressCount: new Set(samsungSnapshots.flatMap((snapshot) => snapshot.address ? [snapshot.address] : [])).size,
      latestSync: samsungSnapshots[0]?.capturedAt ?? null,
      devices: latestDevices.map((snapshot) => ({
        deviceName: snapshot.device.deviceName,
        providerStatus: snapshot.providerStatus,
        address: snapshot.address,
        capturedAt: snapshot.capturedAt
      }))
    }
  });
}
function configIntervalSeconds() {
  return Number(process.env.LOCATION_POLL_INTERVAL_MINUTES || 15) * 60;
}
