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
