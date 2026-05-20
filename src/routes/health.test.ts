import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { makeTestEnv } from "../test/test-env";

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const app = createApp();
    const res = await app.request("/health", {}, makeTestEnv());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { status: "ok" } });
  });

  it("includes security headers on the response", async () => {
    const app = createApp();
    const res = await app.request("/health", {}, makeTestEnv());

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("is not subject to rate limiting", async () => {
    const env = makeTestEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const app = createApp();
    const res = await app.request("/health", {}, env);

    expect(res.status).toBe(200);
  });
});
