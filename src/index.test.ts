import type { ErrorEvent } from "@sentry/cloudflare";
import { describe, expect, it } from "vitest";
import { sentryOptions } from "./index";

describe("sentryOptions", () => {
  it("stays off until a DSN secret exists", () => {
    expect(sentryOptions({})).not.toHaveProperty("dsn");
    expect(sentryOptions({ SENTRY_DSN: "https://k@o1.ingest.sentry.io/1" }).dsn).toBe(
      "https://k@o1.ingest.sentry.io/1",
    );
  });

  it("never collects headers, cookies, query strings, bodies, or user data", () => {
    const options = sentryOptions({});
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    const event = { user: { ip_address: "203.0.113.9" }, message: "x" } as ErrorEvent;
    expect(options.beforeSend(event)).not.toHaveProperty("user");
  });
});
