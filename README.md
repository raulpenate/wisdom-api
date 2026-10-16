<p align="center">
  <img src="public/logo.png" alt="Wisdom API" width="96" />
</p>

<h1 align="center">Wisdom API</h1>

<p align="center">
  A tiny Cloudflare Worker that serves a daily Pixabay image to the<br />
  <a href="https://github.com/ravnhq/wisdom">Wisdom</a> browser extension — one color-matched photo per palette per day, cached in R2, hardened against abuse.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5B2A87?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/runtime-Cloudflare%20Workers-5B2A87?style=flat-square" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/framework-Hono-5B2A87?style=flat-square" alt="Hono" />
  <img src="https://img.shields.io/badge/storage-R2-5B2A87?style=flat-square" alt="R2" />
  <img src="https://img.shields.io/badge/built%20with-TypeScript-5B2A87?style=flat-square" alt="TypeScript" />
</p>

---

Every time Wisdom opens a new tab, it asks this API for the day's wallpaper. The API keeps one color-matched photo per palette for yesterday, today and tomorrow in R2, so every timezone gets a new photo at its own midnight. A cron every 15 minutes fills missing days from Pixabay and deletes old ones. The Pixabay API key never leaves the Worker, the image is streamed straight from R2 to the browser, and per-IP rate limiting keeps the endpoint cheap under load.

## Architecture

How the Worker, R2, the cron, and the extension fit together, with the security and cost model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

![Wisdom architecture](docs/architecture.svg)

## Endpoints

- **`GET /image?palette=<id>&day=<YYYY-MM-DD>`** — that day's photo for the palette, streamed from R2 with ETag.
- **`GET /image/metadata?palette=<id>&day=<YYYY-MM-DD>`** — credit, author and Pixabay links for the same photo.
- **`GET /health`** — cheap liveness probe, rate-limit-exempt.

`palette` is one of `teal`, `blue`, `purple`, `pink`, `red`, `orange`, `yellow`, `green` or `graphite` (default `teal`). `day` is the caller's local date and must be yesterday, today or tomorrow in UTC (default today). Anything else returns 400. Exact days are cached as immutable; fallbacks for a missing day are cached for 5 minutes.

## Getting started

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then fill in PIXABAY_API_KEY
pnpm dev
```

In another terminal:

```bash
curl -s http://127.0.0.1:8787/health | jq .
curl -sI http://127.0.0.1:8787/image
curl -s "http://127.0.0.1:8787/image/metadata?palette=blue" | jq .
```

## Building

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check
pnpm test        # vitest run, against workerd via @cloudflare/vitest-pool-workers
```

## Deploying

```bash
pnpm wrangler r2 bucket create wisdom-images-prod
pnpm wrangler secret put PIXABAY_API_KEY --env production
pnpm deploy --env production
```

The cron (`*/15 * * * *`) fills any missing photo for today and tomorrow, so a fresh deploy is fully stocked within 15 minutes. To trigger it in development:

```bash
curl -X POST "http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*"
```

## Monitoring

Errors and the nightly refresh report to Sentry once a DSN is set. Without it, Sentry stays off.

```sh
pnpm exec wrangler secret put SENTRY_DSN --env production
```

The cron reports to the `daily-wallpapers` monitor, so a missed or failed run alerts. Reports never include IP addresses, headers, cookies, query strings, or bodies. Cloudflare invocation logs are off for the same reason, and our own structured logs carry only request IDs.

## Tech

- [Cloudflare Workers](https://developers.cloudflare.com/workers/): runtime
- [Hono](https://hono.dev): HTTP framework
- [Cloudflare R2](https://developers.cloudflare.com/r2/): image storage
- [Pixabay API](https://pixabay.com/api/docs/): image source
- [Zod](https://zod.dev): boundary validation
- [Vitest](https://vitest.dev) + [`@cloudflare/vitest-pool-workers`](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers): tests against real workerd + Miniflare R2
- [Biome](https://biomejs.dev): lint + format

