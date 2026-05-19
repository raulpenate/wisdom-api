# Product Mission

## Problem

The Wisdom browser extension (ravnhq/wisdom) shows users an inspirational quote on every new tab. To pair each quote with a fresh visual without shipping image assets in the extension bundle, we need a tiny public API that returns a single rotating image, refreshed daily from Pixabay.

Hitting Pixabay directly from every extension instance is not viable:

- Pixabay's API key would have to be embedded in the extension (leak risk).
- Every new-tab open would count against Pixabay's rate limit.
- A burst of installs or an abusive client could exhaust quota or get the key revoked.

The API solves this by acting as a cached, rate-limited proxy: it fetches one image per day from Pixabay, stores it in Cloudflare R2 for 24 hours, and serves every extension request from R2.

## Target Users

End users of the Wisdom browser extension. They are anonymous — the extension calls the API directly with no auth — and potentially numerous, so the API must survive bursty, untrusted traffic.

## Solution

A single-purpose Cloudflare Worker (Hono + TypeScript) with one public endpoint that returns the current cached image from R2. A scheduled Cron Trigger refreshes the image from Pixabay every 24 hours. DDoS and abuse are handled in layers: Cloudflare's network-level protection (free, automatic), the Workers Rate Limiting API for per-IP quotas, and WAF custom rules / bot scoring at the zone edge. The Worker stays stateless — all state lives in R2 — which keeps cold starts cheap and makes the request path trivial.
