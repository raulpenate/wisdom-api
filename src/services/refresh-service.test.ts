import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImageMetadata, hasImage, putImage } from "../repositories/image-repository";
import { clearImages, fixedClock, makeMetadata, makeTestEnv } from "../test/test-env";
import { addDays, utcDay } from "../types/day";
import { PALETTE_IDS } from "../types/palette";
import { refreshDailyImages } from "./refresh-service";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer as ArrayBuffer;
const TODAY = utcDay(fixedClock());
const TOMORROW = addDays(TODAY, 1);
const env = makeTestEnv();

beforeEach(async () => {
  await clearImages(env);
});

function hit(id: number, color: string) {
  return {
    id,
    tags: `nature, ${color}`,
    largeImageURL: `https://cdn.pixabay.com/${color}-${id}.jpg`,
    pageURL: `https://pixabay.com/photos/${color}-${id}/`,
    user: "alice",
    user_id: 7,
  };
}

function stubPixabay({ failColors = [] as string[], failDownloads = false, ids = [1] } = {}) {
  return vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.hostname === "cdn.pixabay.com") {
      return failDownloads
        ? new Response("", { status: 404 })
        : new Response(JPEG_BYTES, { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    const color = url.searchParams.get("colors") ?? "";
    if (failColors.includes(color)) return new Response("", { status: 400 });
    return new Response(JSON.stringify({ hits: ids.map((id) => hit(id, color)) }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
}

describe("refreshDailyImages", () => {
  it("fills today and tomorrow for every palette", async () => {
    const result = await refreshDailyImages(env, { fetcher: stubPixabay(), clock: fixedClock });

    expect(result.ok && result.value.refreshed).toHaveLength(PALETTE_IDS.length * 2);

    const purple = await getImageMetadata(env, TOMORROW, "purple");
    expect(purple.ok && purple.value).toMatchObject({
      day: TOMORROW,
      alt: "nature, lilac",
      url: `https://localhost:8787/image?palette=purple&day=${TOMORROW}`,
      authorUrl: "https://pixabay.com/users/alice-7/",
      expiresAt: `${addDays(TOMORROW, 2)}T00:00:00.000Z`,
    });
  });

  it("is idempotent, so a rerun makes no Pixabay calls", async () => {
    await refreshDailyImages(env, { fetcher: stubPixabay(), clock: fixedClock });
    const fetcher = stubPixabay();

    const rerun = await refreshDailyImages(env, { fetcher, clock: fixedClock });

    expect(rerun.ok && rerun.value.refreshed).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not repeat yesterday's photo when another is available", async () => {
    await refreshDailyImages(env, { fetcher: stubPixabay({ ids: [1, 2] }), clock: fixedClock });

    const today = await getImageMetadata(env, TODAY, "red");
    const tomorrow = await getImageMetadata(env, TOMORROW, "red");
    expect(today.ok && tomorrow.ok && today.value.id !== tomorrow.value.id).toBe(true);
  });

  it("deletes days older than yesterday", async () => {
    const stale = addDays(TODAY, -2);
    await putImage(env, stale, "teal", JPEG_BYTES, makeMetadata(), "image/jpeg");
    await putImage(env, addDays(TODAY, -1), "teal", JPEG_BYTES, makeMetadata(), "image/jpeg");

    const result = await refreshDailyImages(env, { fetcher: stubPixabay(), clock: fixedClock });

    expect(result.ok && result.value.deleted).toBe(1);
    expect(await hasImage(env, stale, "teal")).toBe(false);
    expect(await hasImage(env, addDays(TODAY, -1), "teal")).toBe(true);
  });

  it("keeps going when one palette fails and names the failing stage", async () => {
    const fetcher = stubPixabay({ failColors: ["red"] });

    const result = await refreshDailyImages(env, { fetcher, clock: fixedClock });

    expect(result.ok && result.value.failed).toEqual([
      { day: TODAY, palette: "red", stage: "search", code: "UPSTREAM_FAILURE", statusCode: 400 },
      { day: TOMORROW, palette: "red", stage: "search", code: "UPSTREAM_FAILURE", statusCode: 400 },
    ]);
    expect(await hasImage(env, TODAY, "blue")).toBe(true);
  });

  it("returns UPSTREAM_FAILURE when every palette fails", async () => {
    const fetcher = stubPixabay({ failDownloads: true });

    const result = await refreshDailyImages(env, { fetcher, clock: fixedClock });

    expect(result.ok ? null : result.error.code).toBe("UPSTREAM_FAILURE");
  });
});
