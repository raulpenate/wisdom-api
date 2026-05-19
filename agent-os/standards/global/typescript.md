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
