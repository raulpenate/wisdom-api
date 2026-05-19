import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "./log";

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
});
