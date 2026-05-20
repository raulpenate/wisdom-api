import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { AppError } from "../types/app-error";

const PIXABAY_API_URL = "https://pixabay.com/api/";
const TOP_N = 20;
const MAX_RETRIES = 3;

export type PixabayHit = {
  readonly id: number;
  readonly tags: string;
  readonly largeImageURL: string;
  readonly user: string;
};

type PixabaySearchResponse = {
  readonly hits: PixabayHit[];
};

function fullJitterMs(attempt: number): number {
  const ceiling = Math.min(500 * 2 ** attempt, 10_000);
  return Math.random() * ceiling;
}

export async function searchPixabay(
  apiKey: string,
  query: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Result<PixabayHit[], AppError>> {
  const url = new URL(PIXABAY_API_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(TOP_N));
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");

  let lastError: AppError = { code: "UPSTREAM_FAILURE", upstream: "pixabay" };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, fullJitterMs(attempt)));
    }

    let response: Response;
    try {
      response = await fetcher(url.toString());
    } catch {
      lastError = { code: "UPSTREAM_FAILURE", upstream: "pixabay" };
      continue;
    }

    if (response.status >= 500) {
      lastError = { code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: response.status };
      continue;
    }

    if (!response.ok) {
      return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: response.status });
    }

    let data: PixabaySearchResponse;
    try {
      data = (await response.json()) as PixabaySearchResponse;
    } catch {
      return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay" });
    }

    if (!Array.isArray(data?.hits) || data.hits.length === 0) {
      return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay" });
    }

    return ok(data.hits);
  }

  return err(lastError);
}

export async function downloadImage(
  imageUrl: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Result<{ body: ArrayBuffer; contentType: string }, AppError>> {
  let response: Response;
  try {
    response = await fetcher(imageUrl);
  } catch {
    return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay" });
  }

  if (!response.ok) {
    return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const body = await response.arrayBuffer();
  return ok({ body, contentType });
}
