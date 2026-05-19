# wisdom-api v1 — Shaping Notes

## Scope

A Cloudflare Worker exposing three endpoints (`/image`, `/image/metadata`, `/health`) backed by an R2-cached Pixabay image, refreshed daily by a cron trigger.

## Decisions

- **Three endpoints, not one.** `/image/metadata` is required because Wisdom's `WallpaperRecord` schema demands `credit` + `license` for attribution. Pixabay's content license requires attribution be visible to end users.
- **`/health` and `/image/metadata` are independent.** Health is a fixed-shape no-I/O endpoint; metadata reads R2. No interaction between them.
- **`dominantColor` deferred.** Wisdom's schema includes it; we omit it in v1. Decoding images in Workers requires a pure-JS decoder, which blows the 200 KB bundle budget per `global/dependencies.md`. Wisdom can default it on the consumer side.
- **Cron schedule: `0 0 * * *` UTC daily.** Predictable and easy to reason about.
- **Pixabay query: `nature` by default**, configurable via `PIXABAY_QUERY` env var.
- **Random pick from top N=20 Pixabay results.** Avoids deterministic repetition while staying within a single API call per refresh.
- **Deploy target: `*.workers.dev` for v1.** WAF and bot scoring require a paid Cloudflare zone; deferred. Rate limit + security headers + Cloudflare's free network DDoS protection apply.
- **Rate limit: 60 req/min/IP** on `/image` and `/image/metadata`. `/health` exempt so uptime monitors don't get throttled.
- **All bytes streamed.** R2 objects flow through `ReadableStream` to the response — never buffered. Workers have a 128 MB memory cap; buffering a JPEG is fine on its own but kills concurrency.
- **Linter/formatter: Biome.** Single tool for lint + format, fast, zero-config friendly. CI fails on errors.
- **Package manager: pnpm.** Lockfile committed; CI runs `--frozen-lockfile`.

## Context

- **Visuals:** None. Backend-only API.
- **References:**
  - `ravnhq/wisdom/src/lib/types.ts` — `WallpaperRecord` schema (what our metadata must satisfy).
  - `ravnhq/wisdom/entrypoints/newtab/main.tsx:48-54` — How the URL is consumed (CSS `background-image: url(...)`).
  - `ravnhq/wisdom/src/lib/data.ts` — Zod validation pattern the consumer uses.
- **Product alignment:** Matches `agent-os/product/mission.md` and `roadmap.md` Phase 1 MVP exactly.

## Standards Applied

All ten in `agent-os/standards/`:

- `global/typescript` — strict compiler, no `any`, discriminated unions, branded types, errors as values.
- `global/naming` — kebab-case files, camelCase identifiers, behaviour-named tests.
- `global/code-structure` — layered (`routes → services → repositories → external`), one-way deps.
- `global/testing` — Vitest + `@cloudflare/vitest-pool-workers`, real R2 (no R2 mocks), only Pixabay's `fetch` is stubbed.
- `global/dependencies` — pnpm, lockfile committed, < 200 KB bundle, allowed list only.
- `api/response-format` — `{ ok, data | error }` JSON envelope, binary streamed with ETag + Cache-Control.
- `api/error-handling` — `Result<T,E>`, `AppError` discriminated union, exhaustive HTTP mapping, no throws across module boundaries.
- `api/security` — Wrangler secrets, Zod validation at boundaries, per-IP rate limit, explicit CORS allowlist, security headers on every response.
- `api/observability` — structured JSON logs, requestId per request, log at boundary only, no PII.
- `workers/bindings` — `Env` interface matches `wrangler.jsonc`, validated by Zod at boot, passed explicitly through layers.

## Open items at end of spec

- Wisdom extension IDs (Chrome, Firefox, etc.) for the CORS allowlist — placeholder values until the extension is published.
- Pixabay API key — user-provided at deploy time via `wrangler secret put`.
- Worker hostname — derived from `wrangler deploy` output; written into `WORKER_HOSTNAME` env var on first deploy.
