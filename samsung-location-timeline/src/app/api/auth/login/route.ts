import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { createSession, hasValidOrigin, SESSION_COOKIE } from "@/lib/auth";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.resetAt > now && current.count >= 5)
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !config.adminPasswordHash)
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const valid =
    parsed.data.email.toLowerCase() === config.adminEmail &&
    (await compare(parsed.data.password, config.adminPasswordHash));
  if (!valid) {
    attempts.set(ip, {
      count: current?.resetAt && current.resetAt > now ? current.count + 1 : 1,
      resetAt: now + 15 * 60_000
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSession(parsed.data.email), {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 60 * 60
  });
  return response;
}
