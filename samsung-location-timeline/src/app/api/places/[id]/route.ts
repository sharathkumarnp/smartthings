import { NextResponse } from "next/server";
import { z } from "zod";
import { hasValidOrigin, requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body = z
    .object({ name: z.string().trim().min(1).max(80) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid place name" }, { status: 400 });
  const { id } = await params;
  const place = await prisma.geocodedPlace.findFirst({
    where: { id, device: { user: { email: session.email } } }
  });
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    place: await prisma.geocodedPlace.update({ where: { id }, data: { name: body.data.name } })
  });
}
