import { createMiddleware } from "hono/factory";

export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  c.header("Content-Security-Policy", "default-src 'none'");
  c.header("Permissions-Policy", "()");
  c.header("Cross-Origin-Resource-Policy", "cross-origin");
});
