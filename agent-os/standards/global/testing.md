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
