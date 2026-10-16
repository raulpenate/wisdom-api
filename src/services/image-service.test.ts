import { beforeEach, describe, expect, it } from "vitest";
import { putImage } from "../repositories/image-repository";
import { clearImages, makeMetadata, makeTestEnv } from "../test/test-env";
import { addDays, utcDay } from "../types/day";
import { getDailyImage, getDailyImageMetadata } from "./image-service";

const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;
const NOW = new Date("2026-05-19T12:00:00Z");
const TODAY = utcDay(NOW);
const env = makeTestEnv();

beforeEach(async () => {
  await clearImages(env);
});

describe("getDailyImage", () => {
  it("returns the requested day as an exact match", async () => {
    await putImage(env, TODAY, "teal", IMAGE_BYTES, makeMetadata(), "image/jpeg");

    const result = await getDailyImage(env, TODAY, "teal", NOW);

    expect(result.ok && result.value.exact).toBe(true);
    expect(result.ok && result.value.value.contentType).toBe("image/jpeg");
  });

  it("falls back to yesterday when today and the requested day are missing", async () => {
    await putImage(
      env,
      addDays(TODAY, -1),
      "teal",
      IMAGE_BYTES,
      makeMetadata({ id: "old" }),
      "image/jpeg",
    );

    const result = await getDailyImageMetadata(env, addDays(TODAY, 1), "teal", NOW);

    expect(result.ok && result.value).toMatchObject({ exact: false, value: { id: "old" } });
  });

  it("returns NOT_READY when no day has an image", async () => {
    const result = await getDailyImage(env, TODAY, "teal", NOW);
    expect(result.ok ? null : result.error.code).toBe("NOT_READY");
  });
});
