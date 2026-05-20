import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImage } from "../repositories/image-repository";
import { clearImages, fixedClock, makeTestEnv } from "../test/test-env";
import { refreshDailyImage } from "./refresh-service";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer as ArrayBuffer;
const env = makeTestEnv();
beforeEach(async () => {
  await clearImages(env);
});

function stubSearch(hits: object[]) {
  return vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ hits }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
}

const HITS = [
  {
    id: 42,
    tags: "nature, sky, blue",
    largeImageURL: "https://cdn.pixabay.com/x.jpg",
    user: "alice",
  },
];

describe("refreshDailyImage", () => {
  it("refreshes the cached image from Pixabay and returns 'refreshed'", async () => {
    const fetcher = stubSearch(HITS);

    const result = await refreshDailyImage(env, { fetcher, clock: fixedClock });

    expect(result).toEqual({ ok: true, value: "refreshed" });

    const stored = await getImage(env);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value.metadata.id).toBe("pixabay-42");
    expect(stored.value.metadata.credit).toBe("Photo by alice on Pixabay");
    expect(stored.value.metadata.fetchedAt).toBe("2026-05-19T00:00:00.000Z");
  });

  it("returns UPSTREAM_FAILURE when the Pixabay search fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 500 }));

    const result = await refreshDailyImage(env, { fetcher, clock: fixedClock });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_FAILURE");
  });

  it("returns UPSTREAM_FAILURE when the image download fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hits: HITS }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 404 }));

    const result = await refreshDailyImage(env, { fetcher, clock: fixedClock });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_FAILURE");
  });
});
