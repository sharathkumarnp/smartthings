import { NextResponse } from "next/server";
import { hasValidOrigin, requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SamsungLocationProvider } from "@/integrations/samsung/SamsungLocationProvider";

async function listDevices(email: string) {
  return prisma.device.findMany({
    where: { user: { email } },
    select: {
      id: true,
      providerDeviceId: true,
      deviceName: true,
      model: true,
      provider: true,
      enabled: true,
      capabilities: true,
      locationSupported: true,
      lastAddress: true,
      providerStatus: true,
      lastSyncedAt: true,
      lastSeenAt: true,
      movementState: true
    },
    orderBy: [{ provider: "asc" }, { deviceName: "asc" }]
  });
}

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ devices: await listDevices(session.email) });
}

export async function POST(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { email: session.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const remoteDevices = await new SamsungLocationProvider().getDevices();
    const syncedAt = new Date();
    await prisma.$transaction(
      remoteDevices.map((device) =>
        prisma.device.upsert({
          where: {
            provider_providerDeviceId: {
              provider: "samsung",
              providerDeviceId: device.providerDeviceId
            }
          },
          update: {
            deviceName: device.name,
            model: device.model,
            capabilities: device.capabilities || [],
            locationSupported: device.capabilities?.includes("geolocation") ?? false,
            lastSyncedAt: syncedAt
          },
          create: {
            userId: user.id,
            provider: "samsung",
            providerDeviceId: device.providerDeviceId,
            deviceName: device.name,
            model: device.model,
            capabilities: device.capabilities || [],
            locationSupported: device.capabilities?.includes("geolocation") ?? false,
            lastSyncedAt: syncedAt,
            enabled: true
          }
        })
      )
    );
    await prisma.systemEvent.create({
      data: {
        type: "SMARTTHINGS_DEVICES_SYNCED",
        severity: "INFO",
        message: "Authorized SmartThings device inventory synchronized.",
        metadata: { deviceCount: remoteDevices.length }
      }
    });
    return NextResponse.json({
      devices: await listDevices(session.email),
      syncedCount: remoteDevices.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SmartThings synchronization failed" },
      { status: 502 }
    );
  }
}
