import { NextResponse } from "next/server";
import { hasValidOrigin, requireApiSession } from "@/lib/auth";
import { extractSamsungFindLocation } from "@/integrations/samsung/findBrowser";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const extraction = await extractSamsungFindLocation({ refresh });
    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const scrapedAt = new Date(extraction.extractedAt);
    for (const device of extraction.devices || []) {
      const providerDeviceId = `find-web:${Buffer.from(device.name).toString("base64url")}`;
      const hasLocation = Boolean(device.address && !/location unknown/i.test(device.address));
      const savedDevice = await prisma.device.upsert({
        where: { provider_providerDeviceId: { provider: "samsung", providerDeviceId } },
        update: {
          deviceName: device.name,
          model: "Samsung Find device",
          capabilities: ["samsungFindWeb", ...(hasLocation ? ["addressLocation"] : [])],
          locationSupported: hasLocation,
          lastAddress: hasLocation ? device.address : null,
          providerStatus: device.status,
          lastSyncedAt: scrapedAt,
          ...(device.status === "Now" ? { lastSeenAt: scrapedAt } : {})
        },
        create: {
          userId: user.id,
          provider: "samsung",
          providerDeviceId,
          deviceName: device.name,
          model: "Samsung Find device",
          capabilities: ["samsungFindWeb", ...(hasLocation ? ["addressLocation"] : [])],
          locationSupported: hasLocation,
          lastAddress: hasLocation ? device.address : null,
          providerStatus: device.status,
          lastSyncedAt: scrapedAt,
          lastSeenAt: device.status === "Now" ? scrapedAt : undefined,
          enabled: true
        }
      });
      await prisma.samsungFindSnapshot.create({
        data: {
          deviceId: savedDevice.id,
          address: hasLocation ? device.address : null,
          providerStatus: device.status,
          capturedAt: scrapedAt
        }
      });
    }
    await prisma.systemEvent.create({
      data: {
        type: "SAMSUNG_FIND_DEVICES_UPDATED",
        severity: "INFO",
        message: "Samsung Find device locations updated from the interactive owner session.",
        metadata: { deviceCount: extraction.devices?.length || 0 }
      }
    });

    return NextResponse.json({ ...extraction, syncedDevices: extraction.devices?.length || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Samsung Find extraction failed" },
      { status: 503 }
    );
  }
}
