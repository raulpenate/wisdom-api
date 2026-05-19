<p align="center">
  <img src="public/logo.png" alt="Wisdom API" width="96" />
</p>

<h1 align="center">Wisdom API</h1>

<p align="center">
  A tiny Cloudflare Worker that serves a daily Pixabay image to the<br />
  <a href="https://github.com/ravnhq/wisdom">Wisdom</a> browser extension — cached in R2, refreshed every 24 hours, hardened against abuse.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-D4AF37?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/runtime-Cloudflare%20Workers-D4AF37?style=flat-square" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/framework-Hono-D4AF37?style=flat-square" alt="Hono" />
  <img src="https://img.shields.io/badge/storage-R2-D4AF37?style=flat-square" alt="R2" />
  <img src="https://img.shields.io/badge/built%20with-TypeScript-D4AF37?style=flat-square" alt="TypeScript" />
</p>

---

Every time Wisdom opens a new tab, it asks this API for the day's wallpaper. The API holds a single image in R2 for 24 hours, then a scheduled Worker fetches a fresh one from Pixabay. The Pixabay API key never leaves the Worker, the image is streamed straight from R2 to the browser, and per-IP rate limiting keeps the endpoint cheap under load.

## Endpoints

- **`GET /image`** — streamed bytes of the current day's image, with ETag and `Cache-Control`.
- **`GET /image/metadata`** — JSON envelope with the image URL, credit, license, and cache age.
- **`GET /health`** — cheap liveness probe, rate-limit-exempt.

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
curl -s http://127.0.0.1:8787/image/metadata | jq .
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
pnpm wrangler secret put PIXABAY_API_KEY
pnpm deploy --env production
```

The scheduled trigger (`0 0 * * *` UTC) refreshes the cached image once a day. To trigger a refresh manually in development:

```bash
curl -X POST "http://127.0.0.1:8787/__scheduled?cron=0+0+*+*+*"
```

## Tech

- [Cloudflare Workers](https://developers.cloudflare.com/workers/): runtime
- [Hono](https://hono.dev): HTTP framework
- [Cloudflare R2](https://developers.cloudflare.com/r2/): image storage
- [Pixabay API](https://pixabay.com/api/docs/): image source
- [Zod](https://zod.dev): boundary validation
- [Vitest](https://vitest.dev) + [`@cloudflare/vitest-pool-workers`](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers): tests against real workerd + Miniflare R2
- [Biome](https://biomejs.dev): lint + format

## Project layout

See [`agent-os/`](./agent-os) for the full product mission, engineering standards, and the v1 spec at [`agent-os/specs/2026-05-19-0655-wisdom-api-v1`](./agent-os/specs/2026-05-19-0655-wisdom-api-v1).
