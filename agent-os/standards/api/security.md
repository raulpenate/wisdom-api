# API Security

Layered defense. Each layer is independent — any one of them failing should not collapse the others.

## Secrets

- Live in **Wrangler secrets** (`wrangler secret put PIXABAY_API_KEY`), never in `wrangler.jsonc`, never in `.env` checked into git, never in code.
- Accessed only via `env`. Never logged. Never echoed in a response. Never included in `error.details`.
- Validated at boot via the env schema (`env.ts`); a missing or malformed secret is a deploy-time failure, not a runtime one.

## Input validation

Everything from the network is `unknown`. Validate at the route boundary with Zod (or equivalent), once, and pass parsed values inward.

```ts
const QuerySchema = z.object({
  category: z.enum(["nature", "tech", "abstract"]).optional(),
}).strict();
```

`.strict()` is required — extra fields are an error, not a warning. Reject with `INVALID_REQUEST` (HTTP 400) and a generic message.

The env itself is validated the same way at module init:

```ts
const EnvSchema = z.object({
  PIXABAY_API_KEY: z.string().min(1),
  IMAGES: z.custom<R2Bucket>(),
  RATE_LIMITER: z.custom<RateLimit>(),
});
```

## Rate limiting

Per-IP, at the route entry, before any business logic:

```ts
const ip = c.req.header("cf-connecting-ip");
if (!ip) return err({ code: "INVALID_REQUEST", reason: "missing_ip" });
const { success } = await env.RATE_LIMITER.limit({ key: ip });
if (!success) return err({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
```

Use `cf-connecting-ip`, **not** `x-forwarded-for`. The latter is client-controlled outside Cloudflare's edge.

Quotas (suggested baseline, tune to traffic):

- Image endpoint: 60 req/min/IP
- Any 4xx response counts toward the quota (prevents probing).

Include `Retry-After` header on 429 responses.

## CORS

Explicit allowlist. The Wisdom extension is the only legitimate caller; reflect its origin only if it's on the list. **Never** `Access-Control-Allow-Origin: *`.

```ts
const ALLOWED_ORIGINS = new Set([
  "chrome-extension://<extension-id>",
  "moz-extension://<extension-id>",
]);
```

Preflight (`OPTIONS`) responses do not consume rate-limit quota but do enforce origin checks.

## Security headers

Set on **every** response (binary and JSON), via Hono middleware:

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'
Permissions-Policy: ()
Cross-Origin-Resource-Policy: cross-origin   # required for browser-extension consumption
```

## What we do not do

- No request bodies are accepted on the image endpoint (`GET` only). Reject `POST`/`PUT`/`PATCH` with 405.
- No reflection of user input into responses except validated, enumerated values.
- No logging of headers wholesale — log a redacted subset (`method`, `path`, `cf-connecting-ip`, `user-agent`, `x-request-id`).
- No third-party analytics in the Worker. Observability is `console.log` structured JSON → Workers Logs.

## Layered defense recap

1. Cloudflare network DDoS (free, automatic, can't be turned off).
2. WAF rules / bot scoring at the zone (`cf.bot_management.score < 30` → block).
3. Workers rate limit per IP at route entry.
4. Cheap response surface: streamed bytes from R2, no compute per request.

If any one layer fails open, the others still hold.
