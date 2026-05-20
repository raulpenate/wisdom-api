import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/hono-env";

export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const allowedOrigins = new Set(
    c.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );

  const origin = c.req.header("origin");
  if (origin && allowedOrigins.has(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Vary", "Origin");
  }

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
});
