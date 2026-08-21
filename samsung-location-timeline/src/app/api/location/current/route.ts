import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const [point, devices] = await Promise.all([
    prisma.locationPoint.findFirst({
      where: { device: { user: { email: session.email } } },
      orderBy: { collectedAt: "desc" },
      include: {
        device: { select: { id: true, deviceName: true, model: true, movementState: true, lastSeenAt: true } }
      }
    }),
    prisma.device.findMany({
      where: {
        user: { email: session.email },
        providerDeviceId: { startsWith: "find-web:" },
        enabled: true
      },
      select: {
        id: true,
        deviceName: true,
        model: true,
        lastAddress: true,
        providerStatus: true,
        lastSyncedAt: true,
        lastSeenAt: true,
        locationSupported: true
      },
      orderBy: [{ locationSupported: "desc" }, { deviceName: "asc" }]
    })
  ]);
  if (!point) return NextResponse.json({ point: null, devices });
  const providerAgeMinutes = point.providerTimestamp
    ? (Date.now() - point.providerTimestamp.getTime()) / 60_000
    : null;
  return NextResponse.json({
    devices,
    point: {
      ...point,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      providerAgeMinutes,
      isStale: providerAgeMinutes === null || providerAgeMinutes > config.staleMinutes
    }
  });
}
