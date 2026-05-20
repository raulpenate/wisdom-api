import { Hono } from "hono";
import {
  corsMiddleware,
  errorHandler,
  requestIdMiddleware,
  securityHeadersMiddleware,
} from "./middleware";
import { health, image, imageMetadata } from "./routes";
import type { AppEnv } from "./types/hono-env";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", requestIdMiddleware);
  app.use("*", securityHeadersMiddleware);
  app.use("*", corsMiddleware);
  app.onError(errorHandler);

  app.route("/", health);
  app.route("/", imageMetadata);
  app.route("/", image);

  app.notFound((c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    return c.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Not found.",
          requestId,
        },
      },
      404,
    );
  });

  return app;
}
