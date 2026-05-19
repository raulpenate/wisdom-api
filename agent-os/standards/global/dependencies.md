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
