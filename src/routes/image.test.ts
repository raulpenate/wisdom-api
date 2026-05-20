import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { putImage } from "../repositories/image-repository";
import { clearImages, makeMetadata, makeTestEnv, stubRateLimiter } from "../test/test-env";

const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer as ArrayBuffer;
const env = makeTestEnv();
beforeEach(async () => {
  await clearImages(env);
});

describe("GET /image", () => {
  it("streams image bytes with required headers when an image is cached", async () => {
    const metadata = makeMetadata();
    await putImage(env, IMAGE_BYTES, metadata, "image/jpeg");

    const app = createApp();
    const res = await app.request("/image", {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("ETag")).toBeTruthy();
    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(res.headers.get("X-Image-Source")).toBe("pixabay");
    expect(res.headers.get("X-Cached-At")).toBe(metadata.fetchedAt);

    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBe(IMAGE_BYTES.byteLength);
  });

  it("returns 304 when If-None-Match matches the stored ETag", async () => {
    await putImage(env, IMAGE_BYTES, makeMetadata(), "image/jpeg");

    const app = createApp();
    const firstRes = await app.request("/image", {}, env);
    const etag = firstRes.headers.get("ETag") as string;

    const secondRes = await app.request(
      new Request("http://localhost/image", { headers: { "If-None-Match": etag } }),
      {},
      env,
    );

    expect(secondRes.status).toBe(304);
  });

  it("returns 503 when no image has been cached", async () => {
    const app = createApp();
    const res = await app.request("/image", {}, env);

    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_READY");
  });

  it("returns 429 when the per-IP quota is exhausted", async () => {
    const env = makeTestEnv({ RATE_LIMITER: stubRateLimiter(false) }); // isolated env
    const app = createApp();
    const res = await app.request("/image", {}, env);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
