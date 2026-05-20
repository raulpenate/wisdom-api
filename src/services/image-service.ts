import type { Env } from "../env";
import type { Result } from "../lib/result";
import { ok } from "../lib/result";
import type { StoredImage } from "../repositories/image-repository";
import { getImage } from "../repositories/image-repository";
import type { AppError } from "../types/app-error";
import type { ImageMetadata } from "../types/image";

export async function getDailyImage(env: Env): Promise<Result<StoredImage, AppError>> {
  return getImage(env);
}

export async function getDailyImageMetadata(env: Env): Promise<Result<ImageMetadata, AppError>> {
  const result = await getImage(env);
  if (!result.ok) return result;
  return ok(result.value.metadata);
}
