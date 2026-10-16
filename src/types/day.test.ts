import { describe, expect, it } from "vitest";
import { addDays, parseDay, servedDays, utcDay } from "./day";

const NOW = new Date("2026-10-16T05:00:00Z");

describe("day", () => {
  it("covers every timezone with yesterday, today, and tomorrow in UTC", () => {
    expect(servedDays(NOW)).toEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
  });

  it("rolls over months and years", () => {
    expect(addDays(utcDay(new Date("2026-12-31T12:00:00Z")), 1)).toBe("2027-01-01");
  });

  it("defaults to today and rejects days outside the window or malformed input", () => {
    expect(parseDay(undefined, NOW)).toBe("2026-10-16");
    expect(parseDay("2026-10-17", NOW)).toBe("2026-10-17");
    for (const bad of ["2026-10-18", "2026-10-14", "2026-1-16", "../etc", "2026-10-16x"]) {
      expect(parseDay(bad, NOW)).toBeNull();
    }
  });
});
