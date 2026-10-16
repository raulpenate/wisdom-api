import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { Clock } from "../lib/time";
import {
  deleteImagesBefore,
  getImageMetadata,
  hasImage,
  putImage,
} from "../repositories/image-repository";
import { downloadImage, searchPixabay } from "../repositories/pixabay-client";
import type { AppError } from "../types/app-error";
import { addDays, type Day, servedDays } from "../types/day";
import { PALETTE_IDS, PALETTES, type PaletteId } from "../types/palette";

const TOP_N = 20;

export type RefreshDeps = {
  readonly fetcher: typeof fetch;
  readonly clock: Clock;
};

type Stage = "search" | "download" | "store";

type StageError = { readonly stage: Stage; readonly error: AppError };

export type PaletteFailure = {
  readonly day: Day;
  readonly palette: PaletteId;
  readonly stage: Stage;
  readonly code: AppError["code"];
  readonly statusCode?: number;
};

export type RefreshOutcome = {
  readonly refreshed: readonly string[];
  readonly failed: readonly PaletteFailure[];
  readonly deleted: number;
};

async function previousPhotoId(env: Env, day: Day, palette: PaletteId): Promise<string | null> {
  const previous = await getImageMetadata(env, addDays(day, -1), palette);
  return previous.ok ? previous.value.id : null;
}

async function refreshPalette(
  env: Env,
  day: Day,
  palette: PaletteId,
  deps: RefreshDeps,
): Promise<Result<void, StageError>> {
  const hitsResult = await searchPixabay(
    env.PIXABAY_API_KEY,
    env.PIXABAY_QUERY,
    PALETTES[palette],
    deps.fetcher,
  );
  if (!hitsResult.ok) return err({ stage: "search", error: hitsResult.error });

  const avoid = await previousPhotoId(env, day, palette);
  const top = hitsResult.value.slice(0, TOP_N);
  const fresh = top.filter((candidate) => `pixabay-${candidate.id}` !== avoid);
  const pool = fresh.length > 0 ? fresh : top;
  const hit = pool[Math.floor(Math.random() * pool.length)];
  if (!hit) {
    return err({ stage: "search", error: { code: "UPSTREAM_FAILURE", upstream: "pixabay" } });
  }

  const downloadResult = await downloadImage(hit.largeImageURL, deps.fetcher);
  if (!downloadResult.ok) return err({ stage: "download", error: downloadResult.error });

  const tags = hit.tags
    .split(",")
    .map((t) => t.trim())
    .join(", ");
  const metadata = {
    id: `pixabay-${hit.id}`,
    day,
    title: tags,
    url: `https://${env.WORKER_HOSTNAME}/image?palette=${palette}&day=${day}`,
    alt: tags,
    credit: `Photo by ${hit.user} on Pixabay`,
    author: hit.user,
    authorUrl: `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/`,
    pageUrl: hit.pageURL,
    license: "Pixabay Content License",
    fetchedAt: deps.clock().toISOString(),
    expiresAt: `${addDays(day, 2)}T00:00:00.000Z`,
  };

  const putResult = await putImage(
    env,
    day,
    palette,
    downloadResult.value.body,
    metadata,
    downloadResult.value.contentType,
  );
  return putResult.ok ? putResult : err({ stage: "store", error: putResult.error });
}

export async function refreshDailyImages(
  env: Env,
  deps: RefreshDeps,
): Promise<Result<RefreshOutcome, AppError>> {
  const [yesterday, today, tomorrow] = servedDays(deps.clock());
  const refreshed: string[] = [];
  const failed: PaletteFailure[] = [];
  let firstError: AppError | null = null;

  for (const day of [today, tomorrow]) {
    if (day === undefined) continue;
    for (const palette of PALETTE_IDS) {
      if (await hasImage(env, day, palette)) continue;
      const result = await refreshPalette(env, day, palette, deps);
      if (result.ok) {
        refreshed.push(`${day}/${palette}`);
        continue;
      }
      const { stage, error } = result.error;
      const statusCode = "statusCode" in error ? error.statusCode : undefined;
      failed.push(
        statusCode === undefined
          ? { day, palette, stage, code: error.code }
          : { day, palette, stage, code: error.code, statusCode },
      );
      firstError ??= error;
    }
  }

  const deleted = yesterday ? await deleteImagesBefore(env, yesterday) : 0;

  if (refreshed.length === 0 && firstError) return err(firstError);
  return ok({ refreshed, failed, deleted });
}
