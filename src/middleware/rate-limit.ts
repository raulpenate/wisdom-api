import { createMiddleware } from "hono/factory";
import { checkRateLimit } from "../repositories/rate-limiter";
import { CLIENT_MESSAGE } from "../types/app-error";
import type { AppEnv } from "../types/hono-env";

export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const result = await checkRateLimit(c.env, ip);

  if (!result.ok) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    c.header("Retry-After", "60");
    return c.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: CLIENT_MESSAGE.RATE_LIMITED,
          requestId,
        },
      },
      429,
    );
  }

  await next();
});
