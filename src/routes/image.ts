import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "../lib/log";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { getDailyImage } from "../services/image-service";
import { CLIENT_MESSAGE, toHttpStatus } from "../types/app-error";
import type { AppEnv } from "../types/hono-env";

const image = new Hono<AppEnv>();

image.get("/image", rateLimitMiddleware, async (c) => {
  const requestId = c.get("requestId");
  const result = await getDailyImage(c.env);

  if (!result.ok) {
    log({
      level: result.error.code === "NOT_READY" ? "info" : "error",
      msg: "image_serve_failed",
      requestId,
      data: { code: result.error.code },
    });
    return c.json(
      {
        ok: false,
        error: {
          code: result.error.code,
          message: CLIENT_MESSAGE[result.error.code],
          requestId,
        },
      },
      toHttpStatus(result.error.code) as ContentfulStatusCode,
    );
  }

  const { body, etag, size, contentType, metadata } = result.value;

  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    log({ level: "info", msg: "image_not_modified", requestId });
    return new Response(null, { status: 304 });
  }

  log({ level: "info", msg: "image_served", requestId, data: { size, contentType } });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      ETag: etag,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      "X-Image-Source": "pixabay",
      "X-Cached-At": metadata.fetchedAt,
    },
  });
});

export { image };
