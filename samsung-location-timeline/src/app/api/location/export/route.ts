import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const format = z
    .enum(["csv", "json", "geojson"])
    .catch("json")
    .parse(new URL(request.url).searchParams.get("format"));
  const [points, samsungSnapshots] = await Promise.all([
    prisma.locationPoint.findMany({
      where: { device: { user: { email: session.email } } },
      orderBy: { collectedAt: "asc" }
    }),
    prisma.samsungFindSnapshot.findMany({
      where: { device: { user: { email: session.email } } },
      include: { device: { select: { deviceName: true } } },
      orderBy: { capturedAt: "asc" }
    })
  ]);
  const rows: Array<Record<string, string | number | null>> = samsungSnapshots.length
    ? samsungSnapshots.map((snapshot) => ({
        id: snapshot.id,
        deviceId: snapshot.deviceId,
        deviceName: snapshot.device.deviceName,
        address: snapshot.address,
        providerStatus: snapshot.providerStatus,
        capturedAt: snapshot.capturedAt.toISOString(),
        source: "Samsung Find"
      }))
    : points.map((point) => ({
        id: point.id,
        deviceId: point.deviceId,
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        accuracy: point.accuracy ?? null,
        providerTimestamp: point.providerTimestamp?.toISOString() ?? null,
        collectedAt: point.collectedAt.toISOString(),
        state: point.state,
        distanceFromPrevious: point.distanceFromPrevious ?? null
      }));
  let body: string;
  let type: string;
  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? { id: "", deviceId: "", deviceName: "", address: "", providerStatus: "", capturedAt: "", source: "" });
    body = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => csv(String(row[key] ?? ""))).join(","))
    ].join("\n");
    type = "text/csv";
  } else if (format === "geojson") {
    body = JSON.stringify(
      {
        type: "FeatureCollection",
        features: rows.map((row) => ({
          type: "Feature",
          geometry: typeof row.longitude === "number" && typeof row.latitude === "number"
            ? { type: "Point", coordinates: [row.longitude, row.latitude] }
            : null,
          properties: row
        }))
      },
      null,
      2
    );
    type = "application/geo+json";
  } else {
    body = JSON.stringify(rows, null, 2);
    type = "application/json";
  }
  return new NextResponse(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      "content-disposition": `attachment; filename="location-history.${format}"`,
      "cache-control": "private, no-store"
    }
  });
}
function csv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
