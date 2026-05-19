# API Response Format

This API returns two response classes: **binary** (the image itself) and **JSON** (everything else — health, errors, debug). Each has its own contract.

## Binary responses

The success path of the image endpoint streams bytes from R2 directly. Do **not** wrap in JSON or base64 encode.

Required headers:

| Header              | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| `Content-Type`      | The image MIME (`image/jpeg`, `image/webp`)              |
| `Content-Length`    | From R2 object size                                      |
| `ETag`              | R2 object etag (quoted, strong)                          |
| `Cache-Control`     | `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400` |
| `X-Image-Source`    | `pixabay`                                                |
| `X-Cached-At`       | ISO-8601 timestamp of the R2 object's fetch time         |
| `X-Content-Type-Options` | `nosniff`                                           |

Support conditional requests:

- `If-None-Match` against the ETag → `304 Not Modified` with no body.
- `Range` requests are not supported in v1; respond `200` with the full body.

## JSON responses

Single envelope, discriminated by `ok`:

```ts
type ApiResponse<T> =
  | { ok: true;  data: T }
  | { ok: false; error: ApiError };

type ApiError = {
  code: ErrorCode;          // see api/error-handling.md
  message: string;          // human-readable, safe to surface to client
  requestId: string;        // for correlation in logs
  details?: unknown;        // optional structured context
};
```

Rules:

- `ok` is always present. Never `success`, never `status`. Pick one and never break clients.
- `data` and `error` are mutually exclusive — exactly one is present.
- `message` is **never** an exception message or stack trace. It's a hand-written, client-safe string per `code`.
- `requestId` is always present on both branches. Generate at the route entry (`crypto.randomUUID()`), echo in `X-Request-Id` header.

Example:

```json
{ "ok": true,  "data": { "ageSeconds": 1234 } }
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "Too many requests.", "requestId": "01J..." } }
```

## HTTP status codes

Status reflects semantic outcome:

| Status | When                                                    |
| ------ | ------------------------------------------------------- |
| 200    | Successful binary or JSON response                      |
| 304    | `If-None-Match` matched                                 |
| 400    | Validation failed at the route boundary                 |
| 404    | The cached image hasn't been populated yet              |
| 429    | Rate limit exceeded                                     |
| 500    | Unhandled internal error (never expected in steady state) |
| 502    | Pixabay upstream failure during a refresh               |
| 503    | Temporarily unavailable (cold start, refresh in progress) |

Never return 200 with `ok: false` — status and envelope must agree.

## Headers, always

Every response — binary or JSON — carries:

- `X-Request-Id` (correlates with `requestId` in the body when JSON)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

CORS headers per `api/security.md`.

## Streaming

Read R2 objects as `ReadableStream` and pass straight to `new Response(stream, ...)`. Do not buffer into memory — Workers have a 128MB cap and buffering kills concurrency.
