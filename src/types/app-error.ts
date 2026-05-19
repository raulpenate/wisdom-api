import { assertNever } from "../lib/assert-never";

export type AppError =
  | { readonly code: "INVALID_REQUEST"; readonly reason: string; readonly details?: unknown }
  | { readonly code: "RATE_LIMITED"; readonly retryAfterSeconds: number }
  | { readonly code: "NOT_READY"; readonly reason: "no_image_cached" }
  | {
      readonly code: "UPSTREAM_FAILURE";
      readonly upstream: "pixabay";
      readonly statusCode?: number;
    }
  | { readonly code: "INTERNAL"; readonly cause?: unknown };

export type ErrorCode = AppError["code"];

export function toHttpStatus(code: ErrorCode): number {
  switch (code) {
    case "INVALID_REQUEST":
      return 400;
    case "RATE_LIMITED":
      return 429;
    case "NOT_READY":
      return 503;
    case "UPSTREAM_FAILURE":
      return 502;
    case "INTERNAL":
      return 500;
    default:
      return assertNever(code);
  }
}

export const CLIENT_MESSAGE: Readonly<Record<ErrorCode, string>> = {
  INVALID_REQUEST: "The request was invalid.",
  RATE_LIMITED: "Too many requests.",
  NOT_READY: "The image is not yet available.",
  UPSTREAM_FAILURE: "Upstream image source is unavailable.",
  INTERNAL: "Something went wrong.",
};
