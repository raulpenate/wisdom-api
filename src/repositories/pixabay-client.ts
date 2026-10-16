import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { AppError } from "../types/app-error";

const PIXABAY_API_URL = "https://pixabay.com/api/";
const TOP_N = 20;
const MAX_RETRIES = 3;
const REQUEST_INIT: RequestInit = {
  headers: { "User-Agent": "wisdom-api/0.1 (+https://github.com/raulpenate/wisdom-api)" },
};

export type PixabayHit = {
  readonly id: number;
  readonly tags: string;
  readonly largeImageURL: string;
  readonly pageURL: string;
  readonly user: string;
  readonly user_id: number;
};

type PixabaySearchResponse = {
  readonly hits: PixabayHit[];
};

function fullJitterMs(attempt: number): number {
  const ceiling = Math.min(500 * 2 ** attempt, 10_000);
  return Math.random() * ceiling;
}

function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, fullJitterMs(attempt)));
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function searchPixabay(
  apiKey: string,
  query: string,
  colors: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Result<PixabayHit[], AppError>> {
  const url = new URL(PIXABAY_API_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("colors", colors);
  url.searchParams.set("per_page", String(TOP_N));
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");

  let lastError: AppError = { code: "UPSTREAM_FAILURE", upstream: "pixabay" };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await backoff(attempt);

    let response: Response;
    try {
      response = await fetcher(url.toString(), REQUEST_INIT);
    } catch {
      lastError = { code: "UPSTREAM_FAILURE", upstream: "pixabay" };
      continue;
    }

    if (isRetryable(response.status)) {
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
  let lastError: AppError = { code: "UPSTREAM_FAILURE", upstream: "pixabay" };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await backoff(attempt);

    let response: Response;
    try {
      response = await fetcher(imageUrl, REQUEST_INIT);
    } catch {
      lastError = { code: "UPSTREAM_FAILURE", upstream: "pixabay" };
      continue;
    }

    if (isRetryable(response.status)) {
      lastError = { code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: response.status };
      continue;
    }

    if (!response.ok) {
      return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay", statusCode: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const body = await response.arrayBuffer();
    return ok({ body, contentType });
  }

  return err(lastError);
}
