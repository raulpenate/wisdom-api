import { describe, expect, it } from "vitest";
import { makeTestEnv, stubRateLimiter } from "../test/test-env";
import { checkRateLimit } from "./rate-limiter";

describe("checkRateLimit", () => {
  it("returns ok when the rate limiter allows the request", async () => {
    const env = makeTestEnv({ RATE_LIMITER: stubRateLimiter(true) });
    const result = await checkRateLimit(env, "1.2.3.4");
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns RATE_LIMITED when the quota is exhausted", async () => {
    const env = makeTestEnv({ RATE_LIMITER: stubRateLimiter(false) });
    const result = await checkRateLimit(env, "1.2.3.4");
    expect(result).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", retryAfterSeconds: 60 },
    });
  });
});
