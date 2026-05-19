# Error Handling

Errors are **values**, not control flow. They flow through the system as discriminated unions; they cross the HTTP boundary as the envelope defined in `api/response-format.md`.

## Result type

Every function that can fail returns `Result<T, E>`:

```ts
// lib/result.ts
export type Result<T, E = AppError> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export const ok  = <T>(value: T): Result<T, never> => ({ ok: true,  value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Compose with helpers, not try/catch:

```ts
const cached = await loadCachedImage(env);
if (!cached.ok) return cached;            // propagate
return ok(toResponse(cached.value));
```

## `throw` is reserved

`throw` is for **bugs and invariants**, not domain failures.

- ✓ `throw` when a `never`-branch is reached (`assertNever`).
- ✓ `throw` when an environment variable that the validator missed is undefined at runtime (programmer error).
- ✗ `throw` when Pixabay returns 500 — that's a `Result` with `UPSTREAM_FAILURE`.
- ✗ `throw` when input validation fails — that's a `Result` with `INVALID_REQUEST`.

The top-level Hono error handler catches whatever does escape and maps it to `INTERNAL`, returning a sanitized 500. It never leaks the message to the client.

## Error taxonomy

One closed set, exhaustive:

```ts
export type AppError =
  | { code: "INVALID_REQUEST"; reason: string; details?: unknown }
  | { code: "RATE_LIMITED";    retryAfterSeconds: number }
  | { code: "NOT_READY";       reason: "no_image_cached" }
  | { code: "UPSTREAM_FAILURE"; upstream: "pixabay"; statusCode?: number }
  | { code: "INTERNAL";        cause?: unknown };

export type ErrorCode = AppError["code"];
```

Extending the taxonomy requires a code change, not an ad-hoc string. New errors get a new `code` and a new HTTP-status mapping.

## HTTP mapping

Single function, single switch, exhaustive:

```ts
export function toHttpStatus(code: ErrorCode): number {
  switch (code) {
    case "INVALID_REQUEST":  return 400;
    case "RATE_LIMITED":     return 429;
    case "NOT_READY":        return 503;
    case "UPSTREAM_FAILURE": return 502;
    case "INTERNAL":         return 500;
    default: return assertNever(code);
  }
}
```

If a new code is added, TypeScript fails the compile until this switch is updated.

## Client-safe messages

A separate, hand-written map. The `message` field on the wire is **never** derived from `cause`:

```ts
const CLIENT_MESSAGE: Record<ErrorCode, string> = {
  INVALID_REQUEST:  "The request was invalid.",
  RATE_LIMITED:     "Too many requests.",
  NOT_READY:        "The image is not yet available.",
  UPSTREAM_FAILURE: "Upstream image source is unavailable.",
  INTERNAL:         "Something went wrong.",
};
```

Internal details (`cause`, `statusCode`, stack traces) go to structured logs only.

## Logging

Every error returned to the client is logged once, at the route boundary, with:

- `requestId`
- `error.code`
- `error.cause` (full, including stack if Error)
- A redacted snapshot of the request (method, path, headers minus `authorization` and `cookie`)

Never log secrets, full request bodies, or raw `env`.

## Retries

Retries belong to the **caller of upstream** (`PixabayClient`), not the route. The route is one-shot — if it returned an error, the client retries via a fresh HTTP request, governed by the rate limiter. No retry-loops inside request handlers; they amplify outages.

Upstream calls retry with exponential backoff + full jitter, max 3 attempts, only on 5xx and network errors. Never retry 4xx.
