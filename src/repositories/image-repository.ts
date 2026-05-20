import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { AppError } from "../types/app-error";
import type { ImageMetadata } from "../types/image";

const IMAGE_KEY = "daily-image";
const METADATA_FIELD = "metadata";

export type StoredImage = {
  readonly body: ReadableStream;
  readonly etag: string;
  readonly size: number;
  readonly contentType: string;
  readonly metadata: ImageMetadata;
};

export async function putImage(
  env: Env,
  body: ArrayBuffer,
  metadata: ImageMetadata,
  contentType: string,
): Promise<Result<void, AppError>> {
  try {
    await env.IMAGES.put(IMAGE_KEY, body, {
      httpMetadata: { contentType },
      customMetadata: { [METADATA_FIELD]: JSON.stringify(metadata) },
    });
    return ok(undefined);
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }
}

export async function getImage(env: Env): Promise<Result<StoredImage, AppError>> {
  let object: R2ObjectBody | null;
  try {
    object = await env.IMAGES.get(IMAGE_KEY);
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }

  if (object === null) {
    return err({ code: "NOT_READY", reason: "no_image_cached" });
  }

  const metaJson = object.customMetadata?.[METADATA_FIELD];
  if (!metaJson) {
    return err({ code: "INTERNAL", cause: "R2 object missing metadata field" });
  }

  let metadata: ImageMetadata;
  try {
    metadata = JSON.parse(metaJson) as ImageMetadata;
  } catch (cause) {
    return err({ code: "INTERNAL", cause });
  }

  return ok({
    body: object.body,
    etag: object.httpEtag,
    size: object.size,
    contentType: object.httpMetadata?.contentType ?? "image/jpeg",
    metadata,
  });
}
