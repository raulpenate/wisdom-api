import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "../lib/log";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { getDailyImageMetadata } from "../services/image-service";
import { CLIENT_MESSAGE, toHttpStatus } from "../types/app-error";
import type { AppEnv } from "../types/hono-env";
import { cacheControlFor, readDailyRequest } from "./daily-request";

const imageMetadata = new Hono<AppEnv>();

imageMetadata.get("/image/metadata", rateLimitMiddleware, async (c) => {
  const requestId = c.get("requestId");
  const request = readDailyRequest(c);
  if (request instanceof Response) return request;

  const result = await getDailyImageMetadata(c.env, request.day, request.palette, request.now);

  if (!result.ok) {
    log({
      level: result.error.code === "NOT_READY" ? "info" : "error",
      msg: "metadata_serve_failed",
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

  log({ level: "info", msg: "metadata_served", requestId });
  c.header("Cache-Control", cacheControlFor(request, result.value.exact));
  return c.json({ ok: true, data: result.value.value });
});

export { imageMetadata };
