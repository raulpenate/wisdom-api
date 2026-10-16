import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { putImage } from "../repositories/image-repository";
import { clearImages, makeMetadata, makeTestEnv, stubRateLimiter } from "../test/test-env";
import { addDays, utcDay } from "../types/day";

const NOW = new Date();
const TODAY = utcDay(NOW);

const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;
const env = makeTestEnv();
beforeEach(async () => {
  await clearImages(env);
});

describe("GET /image/metadata", () => {
  it("returns 200 with image metadata when an image is cached", async () => {
    const metadata = makeMetadata();
    await putImage(env, TODAY, "teal", IMAGE_BYTES, metadata, "image/jpeg");

    const app = createApp();
    const res = await app.request("/image/metadata", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: metadata });
  });

  it("serves the requested palette's metadata", async () => {
    await putImage(
      env,
      TODAY,
      "teal",
      IMAGE_BYTES,
      makeMetadata({ id: "pixabay-teal" }),
      "image/jpeg",
    );
    await putImage(
      env,
      TODAY,
      "orange",
      IMAGE_BYTES,
      makeMetadata({ id: "pixabay-orange" }),
      "image/jpeg",
    );

    const app = createApp();
    const res = await app.request("/image/metadata?palette=orange", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("pixabay-orange");
  });

  it("returns 400 for an unknown palette", async () => {
    const app = createApp();
    const res = await app.request("/image/metadata?palette=neon", {}, env);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
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

  it("pins a requested day with long caching, and falls back with short caching", async () => {
    const tomorrow = addDays(TODAY, 1);
    await putImage(env, TODAY, "blue", IMAGE_BYTES, makeMetadata({ id: "today" }), "image/jpeg");
    await putImage(
      env,
      tomorrow,
      "blue",
      IMAGE_BYTES,
      makeMetadata({ id: "tomorrow" }),
      "image/jpeg",
    );
    const app = createApp();

    const pinned = await app.request(`/image/metadata?palette=blue&day=${tomorrow}`, {}, env);
    expect(((await pinned.json()) as { data: { id: string } }).data.id).toBe("tomorrow");
    expect(pinned.headers.get("Cache-Control")).toContain("immutable");

    await env.IMAGES.delete(`daily-image/${tomorrow}/blue`);
    const fallback = await app.request(`/image/metadata?palette=blue&day=${tomorrow}`, {}, env);
    expect(((await fallback.json()) as { data: { id: string } }).data.id).toBe("today");
    expect(fallback.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("rejects days outside yesterday to tomorrow", async () => {
    const app = createApp();
    const res = await app.request(`/image/metadata?palette=blue&day=${addDays(TODAY, 5)}`, {}, env);
    expect(res.status).toBe(400);
  });
});
