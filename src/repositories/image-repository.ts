import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { AppError } from "../types/app-error";
import type { Day } from "../types/day";
import type { ImageMetadata } from "../types/image";
import type { PaletteId } from "../types/palette";

const METADATA_FIELD = "metadata";

const PREFIX = "daily-image/";

function imageKey(day: Day, palette: PaletteId): string {
  return `${PREFIX}${day}/${palette}`;
}

export async function hasImage(env: Env, day: Day, palette: PaletteId): Promise<boolean> {
  return (await env.IMAGES.head(imageKey(day, palette))) !== null;
}

export async function deleteImagesBefore(env: Env, oldest: Day): Promise<number> {
  const stale: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.IMAGES.list({ prefix: PREFIX, ...(cursor ? { cursor } : {}) });
    for (const object of page.objects) {
      const day = object.key.slice(PREFIX.length, PREFIX.length + 10);
      if (day < oldest) stale.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (stale.length > 0) await env.IMAGES.delete(stale);
  return stale.length;
}

export type StoredImage = {
  readonly body: ReadableStream;
  readonly etag: string;
  readonly size: number;
  readonly contentType: string;
  readonly metadata: ImageMetadata;
};

export async function putImage(
  env: Env,
  day: Day,
  palette: PaletteId,
  body: ArrayBuffer,
  metadata: ImageMetadata,
  contentType: string,
): Promise<Result<void, AppError>> {
  try {
    await env.IMAGES.put(imageKey(day, palette), body, {
      httpMetadata: { contentType },
      customMetadata: { [METADATA_FIELD]: JSON.stringify(metadata) },
    });
    return ok(undefined);
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }
}

function parseMetadata(raw: string | undefined): Result<ImageMetadata, AppError> {
  if (!raw) return err({ code: "INTERNAL", cause: "R2 object missing metadata field" });
  try {
    return ok(JSON.parse(raw) as ImageMetadata);
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }
}

export async function getImageMetadata(
  env: Env,
  day: Day,
  palette: PaletteId,
): Promise<Result<ImageMetadata, AppError>> {
  let object: R2Object | null;
  try {
    object = await env.IMAGES.head(imageKey(day, palette));
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }
  if (object === null) return err({ code: "NOT_READY", reason: "no_image_cached" });
  return parseMetadata(object.customMetadata?.[METADATA_FIELD]);
}

export async function getImage(
  env: Env,
  day: Day,
  palette: PaletteId,
): Promise<Result<StoredImage, AppError>> {
  let object: R2ObjectBody | null;
  try {
    object = await env.IMAGES.get(imageKey(day, palette));
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }

  if (object === null) {
    return err({ code: "NOT_READY", reason: "no_image_cached" });
  }

  const metadata = parseMetadata(object.customMetadata?.[METADATA_FIELD]);
  if (!metadata.ok) return metadata;

  return ok({
    body: object.body,
    etag: object.httpEtag,
    size: object.size,
    contentType: object.httpMetadata?.contentType ?? "image/jpeg",
    metadata: metadata.value,
  });
}
