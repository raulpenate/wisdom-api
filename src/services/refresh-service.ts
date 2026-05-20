import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { Clock } from "../lib/time";
import { putImage } from "../repositories/image-repository";
import { downloadImage, searchPixabay } from "../repositories/pixabay-client";
import type { AppError } from "../types/app-error";

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const TOP_N = 20;

export type RefreshDeps = {
  readonly fetcher: typeof fetch;
  readonly clock: Clock;
};

export type RefreshOutcome = "refreshed";

export async function refreshDailyImage(
  env: Env,
  deps: RefreshDeps,
): Promise<Result<RefreshOutcome, AppError>> {
  const hitsResult = await searchPixabay(env.PIXABAY_API_KEY, env.PIXABAY_QUERY, deps.fetcher);
  if (!hitsResult.ok) return hitsResult;

  const hits = hitsResult.value;
  const hit = hits[Math.floor(Math.random() * Math.min(hits.length, TOP_N))];
  if (!hit) {
    return err({ code: "UPSTREAM_FAILURE", upstream: "pixabay" });
  }

  const downloadResult = await downloadImage(hit.largeImageURL, deps.fetcher);
  if (!downloadResult.ok) return downloadResult;

  const now = deps.clock();
  const metadata = {
    id: `pixabay-${hit.id}`,
    title: hit.tags
      .split(",")
      .map((t) => t.trim())
      .join(", "),
    url: `https://${env.WORKER_HOSTNAME}/image`,
    alt: hit.tags
      .split(",")
      .map((t) => t.trim())
      .join(", "),
    credit: `Photo by ${hit.user} on Pixabay`,
    license: "Pixabay Content License",
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };

  const putResult = await putImage(
    env,
    downloadResult.value.body,
    metadata,
    downloadResult.value.contentType,
  );
  if (!putResult.ok) return putResult;

  return ok("refreshed");
}
