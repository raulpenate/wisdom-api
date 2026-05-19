# wisdom-api v1 — Plan

> Source plan for the spec. The full annotated version (with rationale per decision) lives at `/Users/raulpenate/.claude/plans/i-want-to-create-stateless-dijkstra.md`. This file is the executable checklist.

## Context

`wisdom-api` is a single-purpose Cloudflare Worker serving a daily Pixabay image to the [Wisdom browser extension](https://github.com/ravnhq/wisdom). Greenfield repo — only `agent-os/` docs exist prior to v1. All ten standards in `agent-os/standards/` apply.

### Public API surface

| Endpoint              | Returns                                                  |
| --------------------- | -------------------------------------------------------- |
| `GET /image`          | Streamed image bytes from R2 (binary)                    |
| `GET /image/metadata` | JSON envelope with attribution, url, fetched/expires     |
| `GET /health`         | Cheap liveness probe, rate-limit-exempt, no I/O          |

### `ImageMetadata` shape (returned by `/image/metadata`)

```ts
type ImageMetadata = {
  id:        string;  // "pixabay-<hit.id>"
  title:     string;
  url:       string;  // absolute URL to GET /image
  alt:       string;
  credit:    string;  // "Photo by <user> on Pixabay"
  license:   string;  // "Pixabay Content License"
  fetchedAt: string;  // ISO-8601
  expiresAt: string;  // ISO-8601, fetchedAt + 24h
};
```

`dominantColor` from Wisdom's `WallpaperRecord` is omitted in v1 (Workers cannot decode images without a heavy dependency; defer or hardcode on the consumer side).

### Source layout

```
src/
├── index.ts                # fetch + scheduled handlers, loadEnv, ctx.waitUntil
├── app.ts                  # Hono composition + middleware order
├── env.ts                  # Env interface, EnvSchema (zod), loadEnv()
├── routes/{image,image-metadata,health,index}.ts
├── services/{image-service,refresh-service}.ts
├── repositories/{pixabay-client,image-repository,rate-limiter}.ts
├── middleware/{request-id,security-headers,cors,rate-limit,error-handler}.ts
├── lib/{result,assert-never,time,log}.ts
└── types/{app-error,image,env}.ts
```

Every non-glue file gets a parallel `*.test.ts`. Layer rules: `routes → services → repositories → external; lib/` is pure; `Env` passed explicitly.

---

## Task checklist

### Task 1 — Save spec documentation *(this folder)*
- [x] `plan.md` (this file)
- [x] `shape.md`
- [x] `standards.md` (concat of all 10 standards)
- [x] `references.md`
- [x] `visuals/.gitkeep`

### Task 2 — Bootstrap repository
- [ ] `package.json` (name, type=module, engines, packageManager, scripts)
- [ ] `tsconfig.json` (compiler opts from `global/typescript.md`)
- [ ] `wrangler.jsonc` (R2 binding `IMAGES`, RateLimit binding `RATE_LIMITER`, cron `0 0 * * *`, env entries)
- [ ] `.gitignore`, `.dev.vars.example`
- [ ] `vitest.config.ts` (cloudflare/vitest-pool-workers)
- [ ] `biome.json` (lint + format, fail CI on errors)
- [ ] `pnpm install` and commit lockfile
- [ ] **Verify:** `pnpm typecheck && pnpm test && pnpm wrangler --version` all succeed

Dependencies (from `global/dependencies.md` allowed list):
- runtime: `hono`, `zod`
- dev: `typescript`, `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, `@biomejs/biome`

### Task 3 — Foundation: types, errors, env, lib
- [ ] `src/lib/result.ts` + test
- [ ] `src/lib/assert-never.ts` + test
- [ ] `src/lib/time.ts` (Clock, systemClock)
- [ ] `src/lib/log.ts` + test (no banned keys, single JSON line)
- [ ] `src/types/app-error.ts` + test (toHttpStatus exhaustive)
- [ ] `src/types/image.ts`
- [ ] `src/env.ts` + test (loadEnv rejects bad input, freezes result)
- [ ] **Verify:** `pnpm test` green

### Task 4 — Repositories
- [ ] `src/repositories/pixabay-client.ts` + test (fetch stubbed; cover 200, retry on 5xx, malformed JSON, empty hits)
- [ ] `src/repositories/image-repository.ts` + test (real Miniflare R2; write→read, NOT_READY when empty, customMetadata round-trip)
- [ ] `src/repositories/rate-limiter.ts` + test (binding stubbed)

### Task 5 — Services
- [ ] `src/services/image-service.ts` + test (happy + NOT_READY)
- [ ] `src/services/refresh-service.ts` + test (happy, upstream failure, download failure)

### Task 6 — Routes + middleware
- [ ] `src/middleware/{request-id, security-headers, cors, rate-limit, error-handler}.ts`
- [ ] `src/routes/image.ts` (binary stream, ETag, 304 on If-None-Match)
- [ ] `src/routes/image-metadata.ts` (JSON envelope)
- [ ] `src/routes/health.ts` (no I/O, rate-limit-exempt)
- [ ] Route tests via `@cloudflare/vitest-pool-workers` covering 200/304/400/404/429/500/502

### Task 7 — Wire entrypoint
- [ ] `src/app.ts` (createApp, middleware order, route mount, 404 fall-through)
- [ ] `src/index.ts` (fetch + scheduled, loadEnv, ctx.waitUntil, cron logging)
- [ ] `scheduled.test.ts`, `app.test.ts`

### Task 8 — Local smoke test
- [ ] `wrangler dev` starts
- [ ] `curl /health`, `curl -I /image`, `curl /image/metadata` all return expected payloads
- [ ] `curl -X POST /__scheduled?cron=...` refreshes the image; metadata `fetchedAt` updates

### Task 9 — Deploy to workers.dev
- [ ] `wrangler r2 bucket create wisdom-images-prod`
- [ ] `wrangler secret put PIXABAY_API_KEY`
- [ ] `wrangler deploy --env production`
- [ ] Post-deploy smoke on all three endpoints
- [ ] Confirm cron has run (or trigger manually) and `/image` returns Pixabay bytes
- [ ] Verify bundle size < 200 KB compressed

## Out of scope

- Custom domain + WAF rules (defer until CF zone exists)
- `dominantColor` computation
- Multiple categories or `/admin/refresh`
- CI/CD automation

## Verification (after all tasks)

1. `pnpm typecheck && pnpm test && pnpm lint` green
2. Three endpoints respond correctly in prod
3. Cron runs daily at 00:00 UTC and refreshes the R2 object
4. Bundle size under 200 KB compressed
5. This spec folder committed alongside the v1 implementation
