import { describe, expect, it } from "vitest";
import { createSession, requireApiSession, verifySession } from "./auth";
describe("API session authorization", () => {
  it("accepts a signed owner session", async () =>
    expect(await verifySession(await createSession("owner@example.com"))).toEqual({
      email: "owner@example.com"
    }));
  it("rejects a forged session", async () => expect(await verifySession("forged.jwt.value")).toBeNull());
  it("rejects a missing session", async () => expect(await verifySession(undefined)).toBeNull());
  it("rejects an unauthenticated API request", async () => {
    const result = await requireApiSession(new Request("http://localhost/api/devices"));
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) expect(result.status).toBe(401);
  });
  it("accepts an authenticated API request", async () => {
    const token = await createSession("owner@example.com");
    expect(
      await requireApiSession(
        new Request("http://localhost/api/devices", { headers: { cookie: `timeline_session=${token}` } })
      )
    ).toEqual({ email: "owner@example.com" });
  });
});
