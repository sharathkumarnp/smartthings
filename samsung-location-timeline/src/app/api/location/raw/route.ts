import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const [points, samsungSnapshots] = await Promise.all([
    prisma.locationPoint.findMany({
      where: { device: { user: { email: session.email } } },
      orderBy: { collectedAt: "desc" },
      take: 500
    }),
    prisma.samsungFindSnapshot.findMany({
      where: { device: { user: { email: session.email } } },
      include: { device: { select: { deviceName: true } } },
      orderBy: { capturedAt: "desc" },
      take: 500
    })
  ]);
  return NextResponse.json({
    samsungSnapshots: samsungSnapshots.map((snapshot) => ({
      id: snapshot.id,
      capturedAt: snapshot.capturedAt,
      deviceName: snapshot.device.deviceName,
      address: snapshot.address,
      providerStatus: snapshot.providerStatus,
      source: "Samsung Find"
    })),
    points: points.map((p) => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }))
  });
}
