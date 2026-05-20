import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { AppError } from "../types/app-error";

export async function checkRateLimit(env: Env, ip: string): Promise<Result<void, AppError>> {
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return err({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
  }
  return ok(undefined);
}
