import { NextResponse } from "next/server";
import { hasValidOrigin, requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SmartThingsCameraProvider } from "@/integrations/samsung/SmartThingsCameraProvider";

const gatewayUrl = process.env.CAMERA_GATEWAY_URL || "http://camera-gateway:1984";
const cameraRuntime = globalThis as typeof globalThis & { cameraStartQueue?: Promise<void> };
cameraRuntime.cameraStartQueue ??= Promise.resolve();

async function serializeCameraStart<T>(operation: () => Promise<T>) {
  const previous = cameraRuntime.cameraStartQueue;
  let release: () => void = () => void 0;
  cameraRuntime.cameraStartQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function cameraForOwner(id: string, email: string) {
  const device = await prisma.device.findFirst({ where: { id, user: { email }, provider: "samsung" } });
  const capabilities = Array.isArray(device?.capabilities) ? device.capabilities : [];
  return device && capabilities.includes("videoStream") ? device : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const device = await cameraForOwner(id, session.email);
  if (!device) return NextResponse.json({ error: "Camera not found" }, { status: 404 });
  try {
    const streamName = `camera-${device.id}`;
    await serializeCameraStart(async () => {
      const rtspUrl = await new SmartThingsCameraProvider().startStream(device.providerDeviceId);
      const registration = new URL("/api/streams", gatewayUrl);
      registration.searchParams.set("name", streamName);
      registration.searchParams.set("src", rtspUrl);
      const registered = await fetch(registration, { method: "PUT", cache: "no-store" });
      if (!registered.ok) throw new Error("The private camera gateway rejected the stream.");
    });

    const playback = new URL("/api/stream.mp4", gatewayUrl);
    playback.searchParams.set("src", streamName);
    playback.searchParams.set("video", "h264");
    playback.searchParams.set("audio", "aac");
    const stream = await fetch(playback, { cache: "no-store" });
    if (!stream.ok || !stream.body) throw new Error("The camera stream could not be converted for the browser.");
    return new Response(stream.body, {
      headers: {
        "content-type": stream.headers.get("content-type") || "video/mp4",
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Camera preview failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  const device = await cameraForOwner(id, session.email);
  if (!device) return NextResponse.json({ error: "Camera not found" }, { status: 404 });
  const streamName = `camera-${device.id}`;
  const removal = new URL("/api/streams", gatewayUrl);
  removal.searchParams.set("src", streamName);
  await Promise.allSettled([
    new SmartThingsCameraProvider().stopStream(device.providerDeviceId),
    fetch(removal, { method: "DELETE", cache: "no-store" })
  ]);
  return NextResponse.json({ stopped: true });
}
