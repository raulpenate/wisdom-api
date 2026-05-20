import { beforeEach, describe, expect, it } from "vitest";
import { putImage } from "../repositories/image-repository";
import { clearImages, makeMetadata, makeTestEnv } from "../test/test-env";
import { getDailyImage, getDailyImageMetadata } from "./image-service";

const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;
const env = makeTestEnv();
beforeEach(async () => {
  await clearImages(env);
});

describe("getDailyImage", () => {
  it("returns the stored image when one has been cached", async () => {
    const metadata = makeMetadata();
    await putImage(env, IMAGE_BYTES, metadata, "image/jpeg");

    const result = await getDailyImage(env);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metadata).toEqual(metadata);
    expect(result.value.contentType).toBe("image/jpeg");
  });

  it("returns NOT_READY when no image has been cached", async () => {
    const result = await getDailyImage(env);
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_READY", reason: "no_image_cached" },
    });
  });
});

describe("getDailyImageMetadata", () => {
  it("returns image metadata when one has been cached", async () => {
    const metadata = makeMetadata();
    await putImage(env, IMAGE_BYTES, metadata, "image/jpeg");

    const result = await getDailyImageMetadata(env);

    expect(result).toEqual({ ok: true, value: metadata });
  });

  it("returns NOT_READY when no image has been cached", async () => {
    const result = await getDailyImageMetadata(env);
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_READY", reason: "no_image_cached" },
    });
  });
});
