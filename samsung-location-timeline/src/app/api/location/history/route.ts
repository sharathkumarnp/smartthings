import { NextResponse } from "next/server";
import { z } from "zod";
import { endOfDay, format, startOfDay } from "date-fns";
import { requireApiSession } from "@/lib/auth";
import { pointsForRange } from "@/repositories/locationRepository";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const dateValue = new URL(request.url).searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
  const parsed = z.iso.date().safeParse(dateValue);
  if (!parsed.success) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: session.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = new Date(`${dateValue}T12:00:00`);
  const start = startOfDay(date);
  const end = endOfDay(date);
  const [points, stops, trips, samsungSnapshots] = await Promise.all([
    pointsForRange(user.id, start, end),
    prisma.stop.findMany({
      where: {
        device: { userId: user.id },
        startedAt: { lte: end },
        OR: [{ endedAt: null }, { endedAt: { gte: start } }]
      },
      orderBy: { startedAt: "asc" }
    }),
    prisma.trip.findMany({
      where: {
        device: { userId: user.id },
        startedAt: { lte: end },
        OR: [{ endedAt: null }, { endedAt: { gte: start } }]
      },
      orderBy: { startedAt: "asc" }
    }),
    prisma.samsungFindSnapshot.findMany({
      where: {
        device: { userId: user.id },
        capturedAt: { gte: start, lte: end }
      },
      include: { device: { select: { deviceName: true } } },
      orderBy: { capturedAt: "asc" }
    })
  ]);
  return NextResponse.json({
    date: dateValue,
    points: points.map((point) => ({
      ...point,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude)
    })),
    stops: stops.map((stop) => ({
      ...stop,
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude)
    })),
    trips,
    samsungSnapshots: samsungSnapshots.map((snapshot) => ({
      id: snapshot.id,
      deviceId: snapshot.deviceId,
      deviceName: snapshot.device.deviceName,
      address: snapshot.address,
      providerStatus: snapshot.providerStatus,
      capturedAt: snapshot.capturedAt
    }))
  });
}
