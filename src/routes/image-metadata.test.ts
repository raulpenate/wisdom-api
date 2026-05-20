import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { putImage } from "../repositories/image-repository";
import { clearImages, makeMetadata, makeTestEnv, stubRateLimiter } from "../test/test-env";

const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;
const env = makeTestEnv();
beforeEach(async () => {
  await clearImages(env);
});

describe("GET /image/metadata", () => {
  it("returns 200 with image metadata when an image is cached", async () => {
    const metadata = makeMetadata();
    await putImage(env, IMAGE_BYTES, metadata, "image/jpeg");

    const app = createApp();
    const res = await app.request("/image/metadata", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: metadata });
  });

  it("returns 503 when no image has been cached", async () => {
    const app = createApp();
    const res = await app.request("/image/metadata", {}, env);

    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_READY");
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    const env = makeTestEnv({ RATE_LIMITER: stubRateLimiter(false) }); // isolated env
    const app = createApp();
    const res = await app.request("/image/metadata", {}, env);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
