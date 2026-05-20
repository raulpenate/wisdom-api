import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { makeTestEnv } from "./test/test-env";

describe("createApp", () => {
  it("returns 404 with error envelope for unknown routes", async () => {
    const app = createApp();
    const res = await app.request("/not-a-route", {}, makeTestEnv());

    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("echoes X-Request-Id on every response", async () => {
    const app = createApp();
    const res = await app.request("/health", {}, makeTestEnv());
    expect(res.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("sets CORS header for allowed origins", async () => {
    const env = makeTestEnv({
      ALLOWED_ORIGINS: "chrome-extension://abc123",
    });
    const app = createApp();
    const res = await app.request(
      new Request("http://localhost/health", {
        headers: { origin: "chrome-extension://abc123" },
      }),
      {},
      env,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://abc123");
  });

  it("does not set CORS header for disallowed origins", async () => {
    const app = createApp();
    const res = await app.request(
      new Request("http://localhost/health", {
        headers: { origin: "https://evil.example.com" },
      }),
      {},
      makeTestEnv(),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
