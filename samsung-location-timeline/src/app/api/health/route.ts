import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const [device, event] = await Promise.all([
    prisma.device.findFirst({
      where: { user: { email: session.email }, enabled: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.systemEvent.findFirst({ orderBy: { createdAt: "desc" } })
  ]);
  const age = device?.lastSeenAt ? (Date.now() - device.lastSeenAt.getTime()) / 60_000 : Infinity;
  const status =
    event?.type === "SAMSUNG_AUTH_EXPIRED"
      ? "Authentication required"
      : age > config.pollIntervalMinutes * 3
        ? "Collection failed"
        : age > config.pollIntervalMinutes * 1.5
          ? "Delayed"
          : "Healthy";
  return NextResponse.json({
    status,
    lastCollection: device?.lastSeenAt ?? null,
    nextCollection: device?.lastSeenAt
      ? new Date(device.lastSeenAt.getTime() + config.pollIntervalMinutes * 60_000)
      : null,
    provider: config.locationProvider,
    latestEvent: event
  });
}
