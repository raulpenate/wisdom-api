# Product Roadmap

## Phase 1: MVP

- Cloudflare Worker scaffolded with Hono + TypeScript, deployed via Wrangler.
- R2 bucket binding for image storage; one object key holds the current daily image plus its metadata (source URL, fetched-at timestamp).
- Public `GET` endpoint that returns the cached image bytes from R2 with appropriate `Content-Type` and `Cache-Control` headers.
- Pixabay integration that fetches a fresh image using a server-side API key (stored as a Worker secret).
- Cron Trigger configured to refresh the cached image every 24 hours.
- Per-IP rate limiting via the Workers Rate Limiting API binding.
- WAF custom rules / bot-score rules at the zone level to drop low-quality bot traffic before it reaches the Worker.
- Cloudflare's default network DDoS protection enabled (on by default for any Worker behind a CF zone).

## Phase 2: Post-Launch

No further work planned. MVP is the whole product. Future iteration only if the Wisdom extension's needs change.
