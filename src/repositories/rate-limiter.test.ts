import { describe, expect, it } from "vitest";
import { makeTestEnv, stubRateLimiter } from "../test/test-env";
import { checkRateLimit, rateLimitKey } from "./rate-limiter";

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

describe("rateLimitKey", () => {
  it("keeps IPv4 addresses as they are", () => {
    expect(rateLimitKey("203.0.113.9")).toBe("203.0.113.9");
    expect(rateLimitKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("groups every IPv6 address in the same /64", () => {
    const a = rateLimitKey("2001:db8:abcd:12:1111:2222:3333:4444");
    const b = rateLimitKey("2001:0db8:abcd:0012::9");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(rateLimitKey("2001:db8:abcd:13::1")).not.toBe(a);
    expect(rateLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
});
