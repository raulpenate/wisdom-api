import { Hono } from "hono";
import type { AppEnv } from "../types/hono-env";

const health = new Hono<AppEnv>();

health.get("/health", (c) => {
  return c.json({ ok: true, data: { status: "ok" } });
});

export { health };
