import type { Context, ErrorHandler } from "hono";
import { log } from "../lib/log";
import { CLIENT_MESSAGE } from "../types/app-error";
import type { AppEnv } from "../types/hono-env";

export const errorHandler: ErrorHandler<AppEnv> = (err: Error, c: Context<AppEnv>) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();

  log({
    level: "error",
    msg: "unhandled_error",
    requestId,
    data: {
      errorName: err.name,
      errorMessage: err.message,
      method: c.req.method,
      path: c.req.path,
    },
  });

  return c.json(
    {
      ok: false,
      error: {
        code: "INTERNAL",
        message: CLIENT_MESSAGE.INTERNAL,
        requestId,
      },
    },
    500,
  );
};
