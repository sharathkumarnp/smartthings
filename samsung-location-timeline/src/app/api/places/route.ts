import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const [places, snapshots] = await Promise.all([
    prisma.geocodedPlace.findMany({
      where: { device: { user: { email: session.email } } },
      orderBy: [{ visitCount: "desc" }, { lastVisitedAt: "desc" }]
    }),
    prisma.samsungFindSnapshot.findMany({
      where: {
        device: { user: { email: session.email } },
        address: { not: null }
      },
      include: { device: { select: { deviceName: true } } },
      orderBy: { capturedAt: "desc" }
    })
  ]);
  const samsungPlaces = new Map<string, {
    id: string;
    name: string;
    address: string;
    visitCount: number;
    lastVisitedAt: Date;
  }>();
  for (const snapshot of snapshots) {
    if (!snapshot.address) continue;
    const key = `${snapshot.deviceId}:${snapshot.address}`;
    const existing = samsungPlaces.get(key);
    if (existing) existing.visitCount += 1;
    else samsungPlaces.set(key, {
      id: `samsung-find-${snapshot.deviceId}-${Buffer.from(snapshot.address).toString("base64url")}`,
      name: snapshot.device.deviceName,
      address: snapshot.address,
      visitCount: 1,
      lastVisitedAt: snapshot.capturedAt
    });
  }
  return NextResponse.json({
    places: [
      ...[...samsungPlaces.values()].map((place) => ({
        ...place,
        latitude: null,
        longitude: null,
        editable: false,
        source: "Samsung Find"
      })),
      ...places.map((place) => ({ ...place, editable: true, source: "Detected stop" }))
    ]
  });
}
