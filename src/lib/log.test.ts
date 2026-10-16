import { captureException, captureMessage } from "@sentry/cloudflare";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "./log";

vi.mock("@sentry/cloudflare", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

function parseLastLog(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const arg = spy.mock.calls[0]?.[0];
  if (typeof arg !== "string") throw new Error("expected string log argument");
  return JSON.parse(arg) as Record<string, unknown>;
}

describe("log", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("emits a single valid JSON line with required fields", () => {
    log({ level: "info", msg: "hello", requestId: "req-1" });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = parseLastLog(spy);
    expect(parsed["level"]).toBe("info");
    expect(parsed["msg"]).toBe("hello");
    expect(parsed["requestId"]).toBe("req-1");
    expect(typeof parsed["ts"]).toBe("string");
  });

  it("strips banned keys from data", () => {
    log({
      level: "warn",
      msg: "stripped",
      requestId: "req-2",
      data: { authorization: "secret-token", cookie: "sid=123", ok: true, count: 7 },
    });

    const parsed = parseLastLog(spy);
    expect(parsed["authorization"]).toBeUndefined();
    expect(parsed["cookie"]).toBeUndefined();
    expect(parsed["ok"]).toBe(true);
    expect(parsed["count"]).toBe(7);
  });

  it("is case-insensitive when matching banned keys", () => {
    log({
      level: "info",
      msg: "case",
      requestId: "req-3",
      data: { Authorization: "should-be-stripped" },
    });

    const parsed = parseLastLog(spy);
    expect(parsed["Authorization"]).toBeUndefined();
  });

  it("reports warnings and errors to Sentry, but not info", () => {
    vi.mocked(captureMessage).mockClear();
    vi.mocked(captureException).mockClear();
    const boom = new Error("boom");

    log({ level: "info", msg: "ok", requestId: "r1" });
    log({ level: "warn", msg: "partial", requestId: "r2", data: { token: "x", palette: "red" } });
    log({ level: "error", msg: "unhandled", requestId: "r3", error: boom });

    expect(captureMessage).toHaveBeenCalledOnce();
    expect(captureMessage).toHaveBeenCalledWith("partial", {
      level: "warning",
      tags: { requestId: "r2" },
      extra: { palette: "red" },
    });
    expect(captureException).toHaveBeenCalledWith(boom, {
      level: "error",
      tags: { requestId: "r3" },
    });
  });
});
