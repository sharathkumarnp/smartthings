import { NextResponse } from "next/server";
import { z } from "zod";
import { hasValidOrigin, requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid device setting" }, { status: 400 });
  const { id } = await params;
  const device = await prisma.device.findFirst({ where: { id, user: { email: session.email } } });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  const updated = await prisma.device.update({ where: { id }, data: { enabled: body.data.enabled } });
  await prisma.systemEvent.create({
    data: {
      type: "DEVICE_MANAGEMENT_UPDATED",
      severity: "INFO",
      message: body.data.enabled ? "Device included in dashboard." : "Device excluded from dashboard.",
      metadata: { deviceId: id, provider: device.provider }
    }
  });
  return NextResponse.json({ device: updated });
}
