import { describe, expect, it } from "vitest";
import { err, ok } from "./result";

describe("ok", () => {
  it("wraps a value as a success result", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });
});

describe("err", () => {
  it("wraps an error as a failure result", () => {
    expect(err("boom")).toEqual({ ok: false, error: "boom" });
  });
});
