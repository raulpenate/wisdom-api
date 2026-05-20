import { describe, expect, it, vi } from "vitest";
import { downloadImage, searchPixabay } from "./pixabay-client";

const HIT = {
  id: 1,
  tags: "nature, sky",
  largeImageURL: "https://cdn.pixabay.com/a.jpg",
  user: "alice",
};

describe("searchPixabay", () => {
  it("returns hits on a 200 response with valid JSON", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ hits: [HIT] }), { status: 200 }));
    const result = await searchPixabay("key", "nature", fetcher);
    expect(result).toEqual({ ok: true, value: [HIT] });
  });

  it("returns UPSTREAM_FAILURE on 4xx response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const result = await searchPixabay("key", "nature", fetcher);
    expect(result).toEqual({
      ok: false,
      error: { code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: 403 },
    });
  });

  it("retries up to 3 times on 5xx then returns UPSTREAM_FAILURE", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 503 }));

    const result = await searchPixabay("key", "nature", fetcher);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_FAILURE");
    expect(fetcher).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });

  it("returns UPSTREAM_FAILURE on malformed JSON response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));
    const result = await searchPixabay("key", "nature", fetcher);
    expect(result).toEqual({ ok: false, error: { code: "UPSTREAM_FAILURE", upstream: "pixabay" } });
  });

  it("returns UPSTREAM_FAILURE when hits array is empty", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ hits: [] }), { status: 200 }));
    const result = await searchPixabay("key", "nature", fetcher);
    expect(result).toEqual({ ok: false, error: { code: "UPSTREAM_FAILURE", upstream: "pixabay" } });
  });

  it("returns UPSTREAM_FAILURE when fetch throws a network error", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetcher = vi.fn().mockRejectedValue(new Error("network error"));
    const result = await searchPixabay("key", "nature", fetcher);
    expect(result.ok).toBe(false);
    vi.restoreAllMocks();
  });
});

describe("downloadImage", () => {
  it("returns body and content-type on success", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer as ArrayBuffer;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } }),
      );
    const result = await downloadImage("https://cdn.pixabay.com/x.jpg", fetcher);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.contentType).toBe("image/jpeg");
  });

  it("returns UPSTREAM_FAILURE on a non-200 response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const result = await downloadImage("https://cdn.pixabay.com/x.jpg", fetcher);
    expect(result).toEqual({
      ok: false,
      error: { code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: 404 },
    });
  });

  it("returns UPSTREAM_FAILURE when fetch throws", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await downloadImage("https://cdn.pixabay.com/x.jpg", fetcher);
    expect(result.ok).toBe(false);
  });
});
