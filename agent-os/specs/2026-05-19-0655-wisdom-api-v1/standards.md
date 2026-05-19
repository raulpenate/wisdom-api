# Standards for wisdom-api v1

Full content of every standard in `agent-os/standards/` that applies to this spec (all ten). Concatenated here so the spec is reviewable in isolation.

---

## global/typescript

# TypeScript Conventions

Opinionated rules for writing TypeScript in this project. These are non-negotiable defaults; deviations require a comment explaining why.

## Compiler

`tsconfig.json` must enable, at minimum:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"]
  }
}
```

`skipLibCheck` is allowed only on dependencies, never on our own source.

## Banned

- `any` — always replace with `unknown` and narrow.
- `!` (non-null assertion) — narrow with a type guard or fail loudly with an explicit `throw`.
- `as` casts — except `as const`, `as unknown as T` at a single justified boundary (with a comment), and Zod's `.parse()` output.
- `enum` — use string-literal unions or `as const` objects:
  ```ts
  const ErrorCode = {
    UpstreamFailure: "UPSTREAM_FAILURE",
    RateLimited:     "RATE_LIMITED",
  } as const;
  type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
  ```
- `Function`, `Object`, `{}` as types — they erase information. Use specific signatures.
- `namespace` — modules only.

## Required

- **Explicit return types** on every exported function. Internal helpers may rely on inference.
- **`readonly`** on every shared interface field unless mutation is the point. Prefer `ReadonlyArray<T>` over `T[]` for inputs.
- **Discriminated unions** for any value that has more than one shape. Always include a `kind` (or domain-meaningful) tag:
  ```ts
  type ImageFetch =
    | { kind: "fresh";  bytes: ReadableStream; etag: string }
    | { kind: "cached"; bytes: ReadableStream; etag: string; ageSeconds: number }
    | { kind: "miss" };
  ```
- **Branded types** for primitives that aren't interchangeable:
  ```ts
  type ImageId = string & { readonly __brand: "ImageId" };
  ```
- **Type-only imports** when only the type is used:
  ```ts
  import type { Context } from "hono";
  ```
- **Exhaustive checks** in `switch` over unions with a never-assertion:
  ```ts
  function assertNever(x: never): never { throw new Error(`unreachable: ${JSON.stringify(x)}`); }
  ```

## Validation

External input (HTTP requests, env vars, upstream JSON) is `unknown` until parsed. Parse at the boundary with **Zod** (or equivalent) and pass the *parsed type* inward. Never cast.

## Errors as values

Domain errors flow as `Result<T, E>` (see `api/error-handling.md`), not thrown exceptions. `throw` is reserved for invariants and unrecoverable bugs.

---

## global/naming

# Naming Conventions

Predictable naming is half of "good structure". Apply these everywhere.

## Files & directories

- `kebab-case.ts` for source files: `get-daily-image.ts`, not `getDailyImage.ts`.
- One default export per file at most. Prefer named exports — they grep cleanly and survive refactors.
- Test file alongside source: `foo.ts` ↔ `foo.test.ts`.
- Folder names are kebab-case nouns: `routes/`, `services/`, `repositories/`, `lib/`, `types/`.
- `index.ts` is **only** for re-exporting a folder's public surface. No logic in `index.ts`.

## Identifiers

| Kind                 | Style                | Example                                   |
| -------------------- | -------------------- | ----------------------------------------- |
| Type / Interface     | `PascalCase`         | `ImageRecord`, `RateLimitBinding`         |
| Class / Constructor  | `PascalCase`         | `PixabayClient`                           |
| Function / variable  | `camelCase`          | `fetchLatestImage`, `cachedImage`         |
| Compile-time const   | `SCREAMING_SNAKE`    | `MAX_IMAGE_BYTES`, `CACHE_TTL_SECONDS`    |
| Runtime config object| `camelCase`          | `pixabayConfig`                           |
| Generic type param   | Single uppercase, or `TDomainNoun` | `T`, `E`, `TResponse`       |
| Branded type         | `PascalCase`         | `ImageId`, `IpAddress`                    |

## Acronyms

Treat acronyms as words. `HttpClient` not `HTTPClient`. `apiKey` not `aPIKey`. `urlFor` not `uRLFor`. Exception: two-letter acronyms at the start of an identifier may stay uppercase (`IPHeader`) only if the alternative reads worse.

## Booleans

Booleans (vars, props, return values) begin with `is`, `has`, `should`, `can`, `was`, `will`. Never `flag`, never `enable` (verb, not state).

```ts
const isCacheFresh = ageSeconds < CACHE_TTL_SECONDS; // ✓
const cacheFresh   = ageSeconds < CACHE_TTL_SECONDS; // ✗
```

## Functions

- Verbs: `fetchX`, `parseX`, `buildX`, `assertX`.
- Async functions don't get an `async` prefix — the return type already says `Promise<T>`.
- Pure-and-cheap getters can be nouns: `currentImage(env)`, not `getCurrentImage(env)`. Prefix with `get` only if the value is computed or fetched.
- `assert*` throws; `is*` / `has*` returns `boolean`. Never both meanings in one function.

## Tests

Test names describe behaviour, not implementation:

```ts
it("returns the cached image when within the TTL", ...)
it("refreshes from Pixabay after the TTL expires", ...)
```

Not `it("calls fetchImage")` — that's testing the wiring, not the contract.

---

## global/code-structure

# Code Structure

DRY is a *consequence* of correct module boundaries, not an excuse to extract every three-line repeat. These rules define those boundaries.

## Layered architecture

```
src/
├── index.ts            # Worker entrypoint: fetch + scheduled handlers, nothing else
├── app.ts              # Hono app composition (routes only)
├── routes/             # HTTP → call a service → format response
├── services/           # Business logic, orchestration
├── repositories/       # I/O: R2, external HTTP (Pixabay), rate limiter
├── lib/                # Pure utilities, no I/O, no env access
├── types/              # Shared domain types and branded primitives
└── env.ts              # Env binding contract + zod-validated env loader
```

## Dependency direction

Strict one-way:

```
routes → services → repositories → external world
                 ↘ lib (any layer may depend on lib)
```

- A route may not import a repository directly — go through a service.
- A repository may not import a service. If you feel the urge, your service is in the wrong place.
- `lib/` is **pure**: no `env`, no `fetch`, no `Date.now()` at module top-level. Pass time/randomness in.
- No circular imports. Ever. If your linter doesn't fail on cycles, configure it to.

## Bindings

Cloudflare bindings (`R2`, rate limiter, secrets) live on `env`. Pass `env` (or a typed slice of it) explicitly into the functions that need it. Never read bindings via module-scope globals — it kills testability.

```ts
// services/image-service.ts
export async function getDailyImage(env: AppEnv): Promise<Result<ImageRecord>> { ... }
```

## Public surface

Each folder has one `index.ts` that re-exports only what callers outside the folder need. Anything not in `index.ts` is private. Reach across folders only via `index.ts`:

```ts
// ✓
import { getDailyImage } from "../services";
// ✗
import { getDailyImage } from "../services/image-service";
```

Exception: tests in the same folder may import private files directly.

## File size

Soft cap: ~200 LoC per file, excluding imports/types. Hard signal to split when:

- The file has more than one exported entry point that doesn't share state.
- You start writing section comments (`// --- Helpers ---`) to navigate.

## DRY, applied with judgment

- **Two occurrences:** leave it. Premature abstraction costs more than the duplication.
- **Three occurrences, identical shape and intent:** extract.
- **Three occurrences, *similar* shape:** stop. The right abstraction is not obvious. Sleep on it.
- Never extract just because lines look the same — they must mean the same thing. Two routes that both `await env.R2.get(...)` are not the same concern if one is for images and one is for metrics.

## Composition over inheritance

No class hierarchies for domain logic. Plain functions + data. Classes are acceptable for stateful clients (`PixabayClient`, `RateLimiter`) where lifecycle matters.

---

## global/testing

# Testing

Tests prove the contract, not the implementation. Refactors should not break tests — feature changes should.

## Stack

- **Vitest** with `@cloudflare/vitest-pool-workers`. Runs tests inside workerd so R2, rate-limiter, and cron bindings behave like production.
- `wrangler dev --test` is acceptable for end-to-end smoke checks, not a substitute for vitest.

## Test pyramid

| Layer        | What it covers                                | Speed  | Where                       |
| ------------ | --------------------------------------------- | ------ | --------------------------- |
| Unit         | `lib/` pure functions                         | <5ms   | `lib/*.test.ts`             |
| Service      | `services/` with stubbed repositories         | <50ms  | `services/*.test.ts`        |
| Integration  | Full route → service → real R2 (Miniflare)    | <500ms | `routes/*.test.ts`          |
| Cron         | Scheduled handler against real R2 + mocked Pixabay | <500ms | `scheduled/*.test.ts`  |

End-to-end smoke (real Pixabay) is **not** part of CI — run manually before release.

## Mocking

- **Mock only third-party HTTP** (Pixabay). Mock via `fetch` interception (`vi.spyOn(globalThis, "fetch")` or MSW). Never mock our own modules.
- R2 is never mocked — Miniflare provides a real implementation. Mocked R2 has burned us before by lying about consistency semantics.
- Time is injected: services accept a `clock: () => Date` parameter, default `() => new Date()`. Tests pass a fixed clock. No `vi.useFakeTimers()` for production time.

## Structure

AAA, every test:

```ts
it("refreshes the cached image when the TTL has expired", async () => {
  // Arrange
  const env = await testEnv({ cachedAt: oneDayAgo });
  const fetcher = stubPixabay({ url: "https://cdn.pixabay.com/x.jpg" });

  // Act
  const result = await refreshDailyImage(env, { fetcher, clock: fixedNow });

  // Assert
  expect(result).toEqual({ ok: true, value: expect.objectContaining({ kind: "fresh" }) });
});
```

No `beforeEach` that mutates shared module-level state. No conditional logic (`if`, loops) inside a test body — if you need a loop, write `it.each`.

## Naming

Behaviour, not method:

- ✓ `it("returns 429 when the per-IP quota is exhausted", ...)`
- ✗ `it("calls limiter.limit", ...)`

`describe` blocks name the unit under test (`describe("getDailyImage", ...)`), not features (no nested describes deeper than two levels).

## Coverage

Not a target, a smell detector. We expect roughly:

- `lib/`, `services/`: ≥ 90% — these encode the contract.
- `routes/`: ≥ 80% — exercised end-to-end, gaps are acceptable for thin glue.
- `repositories/`: ≥ 70% — happy path + each error branch.
- `index.ts` / `app.ts`: untested by design (composition only).

Coverage drops in a PR should be discussed, not auto-blocked.

---

## global/dependencies

# Dependencies

Every dependency is a long-term liability — supply-chain risk, bundle weight, breaking-change tax, security advisories to triage. Default to none.

## The bar

Add a runtime dependency only when **all four** are true:

1. It replaces ≥ 50 lines of non-trivial code we'd otherwise write and maintain.
2. It is actively maintained — at least one commit in the last 6 months and an open-issue triage rhythm.
3. It is Workers-compatible: no `node:*` built-ins (or only ones polyfilled by workerd), no native modules, no `eval`.
4. It is ESM-native. CJS-only packages are not added.

If any of the four fails, write the code ourselves.

## Banned

- Full HTTP clients (`axios`, `got`, `node-fetch`) — `fetch` is global in workerd.
- `lodash`, `underscore` — use native `Array.prototype` and the structuredClone/Object methods.
- `moment`, `dayjs` (unless date math becomes non-trivial) — `Intl.DateTimeFormat` and ISO-8601 strings cover almost everything.
- Anything that pulls in `node:fs`, `node:net`, `node:tls`, `node:child_process`. Workers don't have a filesystem.
- Packages with deprecation warnings in the last release.

## Allowed and recommended

Runtime:

- `hono` — HTTP framework, the foundation of the API.
- `zod` — validation at every boundary (env, request inputs, upstream responses).

Dev:

- `wrangler` — Cloudflare deploy/dev tool.
- `vitest` + `@cloudflare/vitest-pool-workers` — testing.
- `@cloudflare/workers-types` — type-only.
- `typescript` — pinned to a known-good minor.

Linter/formatter choice is open but must be configured to fail CI on errors, not warn.

## Lockfile

- `pnpm-lock.yaml` is committed. **Always.**
- CI runs `pnpm install --frozen-lockfile`. A drift between `package.json` and the lockfile fails the build.
- `pnpm-workspace.yaml` only if/when we genuinely have multiple packages — not preemptively.

## Updates

- Renovate (or Dependabot) enabled on a weekly cadence.
- Patch and minor PRs may be auto-merged after CI passes.
- **Majors are never auto-merged.** They get a human review, a changelog read, and a deploy to staging first.
- Security advisories from `pnpm audit` are triaged within a week; criticals within 24h.

## Bundle-size budget

The deployed Worker bundle must stay under **200 KB compressed** (Wrangler reports this on deploy).

Measure locally before merging anything that adds a dep:

```bash
pnpm wrangler deploy --dry-run --outdir=dist
ls -l dist/index.js
```

If a single dep blows more than 10% of the budget, justify it in the PR or back it out.

## Transitive dependencies

We own the transitive tree the same way we own direct deps. `pnpm why <pkg>` before adding anything that resolves to a deep dependency graph. A direct dep with 200 transitives is worse than one with 5, all else being equal.

---

## api/response-format

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

---

## api/error-handling

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

---

## api/security

# API Security

Layered defense. Each layer is independent — any one of them failing should not collapse the others.

## Secrets

- Live in **Wrangler secrets** (`wrangler secret put PIXABAY_API_KEY`), never in `wrangler.jsonc`, never in `.env` checked into git, never in code.
- Accessed only via `env`. Never logged. Never echoed in a response. Never included in `error.details`.
- Validated at boot via the env schema (`env.ts`); a missing or malformed secret is a deploy-time failure, not a runtime one.

## Input validation

Everything from the network is `unknown`. Validate at the route boundary with Zod (or equivalent), once, and pass parsed values inward.

```ts
const QuerySchema = z.object({
  category: z.enum(["nature", "tech", "abstract"]).optional(),
}).strict();
```

`.strict()` is required — extra fields are an error, not a warning. Reject with `INVALID_REQUEST` (HTTP 400) and a generic message.

The env itself is validated the same way at module init:

```ts
const EnvSchema = z.object({
  PIXABAY_API_KEY: z.string().min(1),
  IMAGES: z.custom<R2Bucket>(),
  RATE_LIMITER: z.custom<RateLimit>(),
});
```

## Rate limiting

Per-IP, at the route entry, before any business logic:

```ts
const ip = c.req.header("cf-connecting-ip");
if (!ip) return err({ code: "INVALID_REQUEST", reason: "missing_ip" });
const { success } = await env.RATE_LIMITER.limit({ key: ip });
if (!success) return err({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
```

Use `cf-connecting-ip`, **not** `x-forwarded-for`. The latter is client-controlled outside Cloudflare's edge.

Quotas (suggested baseline, tune to traffic):

- Image endpoint: 60 req/min/IP
- Any 4xx response counts toward the quota (prevents probing).

Include `Retry-After` header on 429 responses.

## CORS

Explicit allowlist. The Wisdom extension is the only legitimate caller; reflect its origin only if it's on the list. **Never** `Access-Control-Allow-Origin: *`.

```ts
const ALLOWED_ORIGINS = new Set([
  "chrome-extension://<extension-id>",
  "moz-extension://<extension-id>",
]);
```

Preflight (`OPTIONS`) responses do not consume rate-limit quota but do enforce origin checks.

## Security headers

Set on **every** response (binary and JSON), via Hono middleware:

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'
Permissions-Policy: ()
Cross-Origin-Resource-Policy: cross-origin   # required for browser-extension consumption
```

## What we do not do

- No request bodies are accepted on the image endpoint (`GET` only). Reject `POST`/`PUT`/`PATCH` with 405.
- No reflection of user input into responses except validated, enumerated values.
- No logging of headers wholesale — log a redacted subset (`method`, `path`, `cf-connecting-ip`, `user-agent`, `x-request-id`).
- No third-party analytics in the Worker. Observability is `console.log` structured JSON → Workers Logs.

## Layered defense recap

1. Cloudflare network DDoS (free, automatic, can't be turned off).
2. WAF rules / bot scoring at the zone (`cf.bot_management.score < 30` → block).
3. Workers rate limit per IP at route entry.
4. Cheap response surface: streamed bytes from R2, no compute per request.

If any one layer fails open, the others still hold.

---

## api/observability

# Observability

You can't fix what you can't see. Logs are the entire observability story for this service in v1 — no metrics backend, no APM. That means logs must be **structured, sparse, and correlated**.

## Format

One format, everywhere: a single JSON object per line, written via `console.log`. Workers Logs ingests it automatically.

```ts
function log(env: Env, fields: LogFields): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: fields.level,
    msg: fields.msg,
    requestId: fields.requestId,
    ...fields.data,
  }));
}
```

Required fields on every line:

| Field       | Type                          | Notes                                         |
| ----------- | ----------------------------- | --------------------------------------------- |
| `ts`        | ISO-8601 string               | Generated at log call site                    |
| `level`     | `"info" \| "warn" \| "error"` | No `debug` in production                      |
| `msg`       | string                        | Short, lowercase, no variables interpolated   |
| `requestId` | string (UUID)                 | Always present; for cron, use a per-run UUID  |

Additional structured fields go under their own keys — never concatenated into `msg`. **Good:** `{ "msg": "image_served", "ageSeconds": 1234 }`. **Bad:** `{ "msg": "image served after 1234s" }`.

## Request correlation

- Generate `requestId = crypto.randomUUID()` at the route entry.
- Store on Hono context: `c.set("requestId", requestId)`.
- Echo in `X-Request-Id` response header (every response, including errors).
- Include in the JSON error envelope's `error.requestId`.
- Pass into every service/repository call that might log.

For cron handlers: generate a `requestId` at the start of the scheduled run; reuse it for every log line in that run.

## When to log

- **Once per request, at the route boundary.** Log the outcome (success or failure) after the response is built. Internal services/repositories do not log — they return `Result`s. This rule keeps logs proportional to traffic and trivially searchable.
- **Exception:** cron handlers log start (`cron.started`), end (`cron.finished`), and any non-recoverable error inside the run.
- **Exception:** unhandled errors caught by the top-level error handler are logged at `error` with `code: "INTERNAL"` and full `cause`.

Do not log inside loops. Do not log inside hot retry paths.

## Levels

| Level   | When                                                                 |
| ------- | -------------------------------------------------------------------- |
| `info`  | Successful request, expected domain error (4xx returned to client)   |
| `warn`  | Recovered upstream failure, near-quota events, deprecated input shapes |
| `error` | `INTERNAL` errors (i.e. bugs), 5xx responses, cron failures          |

4xx is `info` because it's the system working correctly. 5xx is `error` because it isn't.

## Never log

- Secrets: API keys, tokens, anything from `env` whose name implies sensitivity.
- Authorization/cookie headers: omit entirely; do not even include the key with a redacted value.
- Full request bodies or response bodies.
- Raw `env` object (`console.log(env)` is banned).
- Stack traces that include user-supplied data verbatim. Log `error.cause.message` and `error.cause.name`, not the full `error.cause`.
- IPs in clear text if we ever add user accounts. Until then, `cf-connecting-ip` is acceptable because the service is anonymous.

## Sampling

100% in v1. We expect very low cardinality (one route, one cron). Add sampling only when Workers Logs cost becomes material.

## Cron handlers

Every scheduled run produces exactly two log lines on the happy path:

```json
{"ts":"...","level":"info","msg":"cron.started","requestId":"...","schedule":"0 0 * * *"}
{"ts":"...","level":"info","msg":"cron.finished","requestId":"...","durationMs":1842,"outcome":"refreshed"}
```

And one additional `error` line if the run fails. A cron that produces zero lines is broken.

---

## workers/bindings

# Cloudflare Workers — Bindings & Env

Bindings are how the Worker reaches the outside world (R2, rate limiter, secrets). They are the **only** legal entry point for I/O. Anything that needs I/O takes `Env` as a parameter; nothing reaches it implicitly.

## The `Env` type

Defined once, in `src/env.ts`:

```ts
import type { R2Bucket, RateLimit } from "@cloudflare/workers-types";

export interface Env {
  // R2
  readonly IMAGES: R2Bucket;

  // Workers Rate Limiting API
  readonly RATE_LIMITER: RateLimit;

  // Secrets
  readonly PIXABAY_API_KEY: string;

  // Non-secret config (vars)
  readonly ENVIRONMENT: "dev" | "staging" | "prod";
  readonly PIXABAY_QUERY: string;
}
```

Rules:

- Every field is `readonly`. Bindings are not assignable.
- Names match `wrangler.jsonc` **exactly** (case-sensitive). A mismatch is a deploy failure — preferable to a silent `undefined` at runtime.
- Secrets and vars both live on `Env` (Workers makes no runtime distinction). Validation in `loadEnv()` enforces presence and shape.

## Loading and validating

Boot once, fail loud:

```ts
// src/env.ts
import { z } from "zod";

const EnvSchema = z.object({
  IMAGES: z.custom<R2Bucket>((v) => !!v && typeof (v as R2Bucket).get === "function"),
  RATE_LIMITER: z.custom<RateLimit>((v) => !!v && typeof (v as RateLimit).limit === "function"),
  PIXABAY_API_KEY: z.string().min(1),
  ENVIRONMENT: z.enum(["dev", "staging", "prod"]),
  PIXABAY_QUERY: z.string().min(1),
});

export function loadEnv(raw: unknown): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    // Programmer error — invariant violation, not domain error
    throw new Error(`Invalid Env: ${parsed.error.message}`);
  }
  return Object.freeze(parsed.data) as Env;
}
```

`loadEnv(env)` runs at the entrypoint (`src/index.ts`), once per request and once per scheduled invocation. The cost is negligible; the safety is non-negotiable.

## Passing bindings around

Explicit always. Services and repositories take `Env` (or a typed subset) as the first argument:

```ts
export async function getDailyImage(env: Env): Promise<Result<ImageRecord>> { ... }
export async function refreshDailyImage(env: Env, deps: RefreshDeps): Promise<Result<void>> { ... }
```

**Forbidden:**

- Module-scope state derived from `env`.
- Singletons holding a binding reference.
- `globalThis.env = env` and friends.

Why: bindings change between environments and between tests. Module-scope capture makes both fragile.

## Bindings ↔ layer boundaries

- **Routes** read `env` from `c.env`, call `loadEnv()`, pass the result to a service.
- **Services** orchestrate; they may pass `env` to repositories.
- **Repositories** are the only files that call `env.IMAGES.get/put/delete`, `env.RATE_LIMITER.limit`, or any other binding method.
- **`lib/`** must not import `Env` or accept it as a parameter — `lib/` is pure.

Crossing these boundaries is a structural bug. Reviewers should reject PRs that touch `env.IMAGES` from a route or service.

## Scheduled handlers (cron)

```ts
// src/index.ts
export default {
  async fetch(req: Request, raw: unknown, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(req, loadEnv(raw), ctx);
  },

  async scheduled(controller: ScheduledController, raw: unknown, ctx: ExecutionContext): Promise<void> {
    const env = loadEnv(raw);
    ctx.waitUntil(refreshDailyImage(env, { fetcher: globalThis.fetch, clock: () => new Date() }));
  },
};
```

- `scheduled` is a thin wrapper. Business logic lives in `refreshDailyImage`.
- `ctx.waitUntil` is mandatory — otherwise the runtime may kill the work mid-flight.
- The cron handler must be idempotent: re-running the same schedule should not corrupt R2 or double-charge Pixabay. Use ETag or `If-None-Match` semantics on the upstream call where possible.

## Local development

- `wrangler.jsonc` carries non-secret vars and binding declarations.
- `.dev.vars` (gitignored, never committed) carries local secret values.
- `wrangler dev` reads both automatically.
- Production secrets are set with `wrangler secret put NAME` and stored encrypted by Cloudflare.

`.dev.vars` is in `.gitignore` from day one. If it leaks, rotate the secret immediately and audit logs.

## Multiple environments

In `wrangler.jsonc`:

```jsonc
{
  "name": "wisdom-api",
  "env": {
    "staging": {
      "vars": { "ENVIRONMENT": "staging", "PIXABAY_QUERY": "nature" },
      "r2_buckets": [{ "binding": "IMAGES", "bucket_name": "wisdom-images-staging" }]
    },
    "production": {
      "vars": { "ENVIRONMENT": "prod", "PIXABAY_QUERY": "nature" },
      "r2_buckets": [{ "binding": "IMAGES", "bucket_name": "wisdom-images-prod" }]
    }
  }
}
```

- Binding **names** are identical across environments. Only **values** differ.
- This keeps the `Env` interface single-source-of-truth and lets tests use a `dev` env without code branches.

## Testing

Tests use `@cloudflare/vitest-pool-workers`, which provides real bindings against Miniflare. The test harness constructs an `Env` per-test from a factory:

```ts
// test/helpers/test-env.ts
export function testEnv(overrides: Partial<Env> = {}): Env {
  return Object.freeze({
    IMAGES: getMiniflareR2(),
    RATE_LIMITER: stubRateLimiter({ allow: true }),
    PIXABAY_API_KEY: "test-key",
    ENVIRONMENT: "dev",
    PIXABAY_QUERY: "nature",
    ...overrides,
  });
}
```

Never construct an `Env` with `as Env` from an empty object — fields will be `undefined` and tests will lie.

