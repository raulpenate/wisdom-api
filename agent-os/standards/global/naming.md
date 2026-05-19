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
