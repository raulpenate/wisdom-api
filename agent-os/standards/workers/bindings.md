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
