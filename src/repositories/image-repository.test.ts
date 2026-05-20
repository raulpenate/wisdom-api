import { beforeEach, describe, expect, it } from "vitest";
import { clearImages, makeMetadata, makeTestEnv } from "../test/test-env";

const env = makeTestEnv();
beforeEach(async () => {
  await clearImages(env);
});

import { getImage, putImage } from "./image-repository";

const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;

describe("putImage + getImage", () => {
  it("stores and retrieves image bytes with metadata round-trip", async () => {
    const metadata = makeMetadata();

    const putResult = await putImage(env, IMAGE_BYTES, metadata, "image/jpeg");
    expect(putResult).toEqual({ ok: true, value: undefined });

    const getResult = await getImage(env);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;

    expect(getResult.value.metadata).toEqual(metadata);
    expect(getResult.value.contentType).toBe("image/jpeg");
    expect(typeof getResult.value.etag).toBe("string");
    expect(getResult.value.size).toBe(IMAGE_BYTES.byteLength);
  });

  it("returns NOT_READY when no image has been cached", async () => {
    const result = await getImage(env);
    expect(result).toEqual({ ok: false, error: { code: "NOT_READY", reason: "no_image_cached" } });
  });

  it("round-trips all customMetadata fields correctly", async () => {
    const metadata = makeMetadata({ id: "pixabay-999", credit: "Photo by bob on Pixabay" });

    await putImage(env, IMAGE_BYTES, metadata, "image/webp");
    const result = await getImage(env);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metadata.id).toBe("pixabay-999");
    expect(result.value.metadata.credit).toBe("Photo by bob on Pixabay");
    expect(result.value.contentType).toBe("image/webp");
  });
});
