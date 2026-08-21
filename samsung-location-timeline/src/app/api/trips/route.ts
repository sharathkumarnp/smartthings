import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  return NextResponse.json({
    trips: await prisma.trip.findMany({
      where: { device: { user: { email: session.email } } },
      orderBy: { startedAt: "desc" },
      take: 100
    })
  });
}
