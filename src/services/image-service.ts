import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { StoredImage } from "../repositories/image-repository";
import { getImage, getImageMetadata } from "../repositories/image-repository";
import type { AppError } from "../types/app-error";
import { type Day, servedDays } from "../types/day";
import type { ImageMetadata } from "../types/image";
import type { PaletteId } from "../types/palette";

export type Served<T> = { readonly value: T; readonly exact: boolean };

async function findForDay<T>(
  day: Day,
  now: Date,
  load: (candidate: Day) => Promise<Result<T, AppError>>,
): Promise<Result<Served<T>, AppError>> {
  const [yesterday, today] = servedDays(now);
  for (const candidate of new Set([day, today, yesterday])) {
    if (candidate === undefined) continue;
    const result = await load(candidate);
    if (result.ok) return ok({ value: result.value, exact: candidate === day });
    if (result.error.code !== "NOT_READY") return result;
  }
  return err({ code: "NOT_READY", reason: "no_image_cached" });
}

export function getDailyImage(
  env: Env,
  day: Day,
  palette: PaletteId,
  now: Date,
): Promise<Result<Served<StoredImage>, AppError>> {
  return findForDay(day, now, (candidate) => getImage(env, candidate, palette));
}

export function getDailyImageMetadata(
  env: Env,
  day: Day,
  palette: PaletteId,
  now: Date,
): Promise<Result<Served<ImageMetadata>, AppError>> {
  return findForDay(day, now, (candidate) => getImageMetadata(env, candidate, palette));
}
