# References for wisdom-api v1

## Wisdom extension (consumer)

The API is built specifically to feed the Wisdom browser extension at `ravnhq/wisdom`. The following files in that repo informed v1's contract.

### WallpaperRecord type

- **Location:** `ravnhq/wisdom/src/lib/types.ts`
- **Relevance:** Defines the schema our `/image/metadata` response must satisfy.
- **Original shape:**
  ```ts
  export type WallpaperRecord = {
    id: string;
    title: string;
    fileName: string;
    alt: string;
    credit: string;
    license: string;
    dominantColor: string;
  };
  ```
- **Our mapping for v1:**
  - `id` → `"pixabay-<hit.id>"`
  - `title` → joined Pixabay tags
  - `fileName` → **replaced by `url`** (absolute URL to `/image`)
  - `alt` → derived from Pixabay tags
  - `credit` → `"Photo by <user> on Pixabay"`
  - `license` → `"Pixabay Content License"`
  - `dominantColor` → **omitted in v1**; Wisdom defaults on consumer side
- **Additions:** `fetchedAt` and `expiresAt` (ISO-8601 timestamps) for cache awareness

### Wallpaper consumption

- **Location:** `ravnhq/wisdom/entrypoints/newtab/main.tsx:48-54`
- **Relevance:** Shows how the URL is consumed — CSS `background-image: url(...)`.
- **Original code:**
  ```ts
  const wallpaperUrl = wallpaper
    ? `/wallpapers/${wallpaper.fileName}`
    : "/wallpapers/misty-forest.svg";
  // ...
  style={{
    backgroundImage: `linear-gradient(...), url(${wallpaperUrl})`,
  }}
  ```
- **Implications for our API:**
  - The URL is consumed directly by the browser as a CSS resource.
  - We must serve correct `Content-Type` so the browser caches and renders correctly.
  - CORS headers must allow loading from the extension's origin (`chrome-extension://...`, `moz-extension://...`).
  - `Cache-Control` with a reasonable `max-age` so repeated new-tab opens don't re-fetch from origin.

### Zod validation pattern

- **Location:** `ravnhq/wisdom/src/lib/data.ts`
- **Relevance:** Wisdom uses Zod with `.strict()`-ish schemas to validate JSON. Our `/image/metadata` response must parse cleanly under their schema.
- **Original code:**
  ```ts
  const wallpaperSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    fileName: z.string().min(1),
    alt: z.string().min(1),
    credit: z.string().min(1),
    license: z.string().min(1),
    dominantColor: z.string().min(1),
  });
  ```
- **Implications:**
  - All required string fields in our response must be non-empty.
  - Wisdom may need to update their schema to accept `url` instead of `fileName`, and to make `dominantColor` optional.

## Cloudflare Workers references

### Hono on Workers

- **Source:** [Hono docs](https://hono.dev/) (informational, not a code reference)
- **Relevance:** Idiomatic patterns for Workers-targeted Hono apps (env binding types via generics, middleware ordering, `c.env` access).

### Workers Rate Limiting API

- **Source:** [Cloudflare docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- **Relevance:** The `RATE_LIMITER` binding interface — `env.RATE_LIMITER.limit({ key })` returns `{ success: boolean }`.

### R2 customMetadata

- **Source:** [Cloudflare R2 docs](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#bucketget)
- **Relevance:** `R2Object.customMetadata: Record<string, string>` stores our `ImageMetadata` alongside the binary, eliminating a second R2 read on the metadata endpoint.

## Out-of-repo references

None — no other open-source implementations consulted. The design is derived from the standards in `agent-os/standards/` and the consumer contract from `ravnhq/wisdom`.
