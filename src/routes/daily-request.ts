import type { Context } from "hono";
import { CLIENT_MESSAGE } from "../types/app-error";
import { type Day, parseDay } from "../types/day";
import type { AppEnv } from "../types/hono-env";
import { type PaletteId, parsePalette } from "../types/palette";

export type DailyRequest = {
  readonly palette: PaletteId;
  readonly day: Day;
  readonly pinned: boolean;
  readonly now: Date;
};

const IMMUTABLE = "public, max-age=172800, immutable";
const SHORT = "public, max-age=300";

export function readDailyRequest(c: Context<AppEnv>): DailyRequest | Response {
  const now = new Date();
  const rawDay = c.req.query("day");
  const palette = parsePalette(c.req.query("palette"));
  const day = parseDay(rawDay, now);
  if (palette && day) return { palette, day, pinned: rawDay !== undefined, now };
  return c.json(
    {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: CLIENT_MESSAGE.INVALID_REQUEST,
        requestId: c.get("requestId"),
      },
    },
    400,
  );
}

export function cacheControlFor(request: DailyRequest, exact: boolean): string {
  return request.pinned && exact ? IMMUTABLE : SHORT;
}
