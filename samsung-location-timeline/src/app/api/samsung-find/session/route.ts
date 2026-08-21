import { NextResponse } from "next/server";
import { hasValidOrigin, requireApiSession } from "@/lib/auth";
import {
  connectSamsungFindBrowser,
  disconnectSamsungFindBrowser,
  getSamsungFindBrowserStatus
} from "@/integrations/samsung/findBrowser";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json(await getSamsungFindBrowserStatus());
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "Browser status failed" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    return NextResponse.json(await connectSamsungFindBrowser());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Samsung Find browser failed" },
      { status: 503 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await disconnectSamsungFindBrowser();
  return NextResponse.json({ connected: false });
}
