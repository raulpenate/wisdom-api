import { describe, expect, it } from "vitest";
import { CLIENT_MESSAGE, type ErrorCode, toHttpStatus } from "./app-error";

const ALL_CODES = [
  "INVALID_REQUEST",
  "RATE_LIMITED",
  "NOT_READY",
  "UPSTREAM_FAILURE",
  "INTERNAL",
] as const satisfies ReadonlyArray<ErrorCode>;

describe("toHttpStatus", () => {
  it.each(ALL_CODES)("maps %s to a 4xx or 5xx status", (code) => {
    const status = toHttpStatus(code);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(600);
  });

  it("maps INVALID_REQUEST to 400", () => {
    expect(toHttpStatus("INVALID_REQUEST")).toBe(400);
  });

  it("maps RATE_LIMITED to 429", () => {
    expect(toHttpStatus("RATE_LIMITED")).toBe(429);
  });

  it("maps UPSTREAM_FAILURE to 502", () => {
    expect(toHttpStatus("UPSTREAM_FAILURE")).toBe(502);
  });
});

describe("CLIENT_MESSAGE", () => {
  it.each(ALL_CODES)("has a non-empty client-safe message for %s", (code) => {
    expect(CLIENT_MESSAGE[code]).toMatch(/\S/);
  });

  it("never leaks internal details to the client", () => {
    for (const code of ALL_CODES) {
      const msg = CLIENT_MESSAGE[code];
      expect(msg).not.toMatch(/stack|trace|cause|undefined/i);
    }
  });
});
