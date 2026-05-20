import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/hono-env";

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
});
