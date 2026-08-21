import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "./config";

export const SESSION_COOKIE = "timeline_session";
const secret = new TextEncoder().encode(config.authSecret);

export async function createSession(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase(), role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email.toLowerCase())
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifySession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.email === "string" && payload.role === "owner" ? { email: payload.email } : null;
  } catch {
    return null;
  }
}

export async function currentSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireApiSession(request: Request): Promise<{ email: string } | NextResponse> {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const session = await verifySession(token);
  return session ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return config.nodeEnv !== "production";
  return origin === new URL(config.appUrl).origin;
}
