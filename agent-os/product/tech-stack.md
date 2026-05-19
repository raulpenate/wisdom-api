# Tech Stack

## Frontend

N/A — this is a backend-only API. The frontend consumer is the separate Wisdom browser extension (ravnhq/wisdom).

## Backend

- **Runtime:** Cloudflare Workers (workerd / V8 isolates).
- **Framework:** Hono (TypeScript).
- **Language:** TypeScript.
- **Package manager:** pnpm.
- **Local dev / deploy tooling:** Wrangler (Node-based). Bun is intentionally *not* used — Workers run on workerd, not Bun, so the toolchain stays on Node + pnpm for stability and alignment with Cloudflare docs.

## Storage

- **Cloudflare R2** — single bucket; holds the current daily image and its small metadata sidecar (or metadata stored as R2 custom metadata on the same object).

## Scheduling

- **Cloudflare Cron Triggers** — one cron entry running every 24 hours to fetch a new image from Pixabay and overwrite the R2 object.

## External APIs

- **Pixabay API** — image source. API key stored as a Worker secret (`wrangler secret put`), never exposed to clients.

## Security / Abuse Mitigation

- Cloudflare network DDoS protection (default, free tier).
- **Workers Rate Limiting API** binding — per-IP request quota on the public endpoint.
- **Cloudflare WAF custom rules / bot scoring** at the zone level — drop low-bot-score requests before they reach the Worker.
- Pixabay API key kept as a Worker secret; never returned to the client.

## Hosting / Deployment

- Cloudflare Workers, deployed via `wrangler deploy`. Configuration in `wrangler.jsonc` including R2 binding, rate-limit binding, and the cron trigger schedule.
