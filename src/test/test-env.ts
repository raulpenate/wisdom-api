import { env } from "cloudflare:test";
import type { Env } from "../env";
import type { ImageMetadata } from "../types/image";

export function stubRateLimiter(allow: boolean): RateLimit {
  return { limit: async () => ({ success: allow }) };
}

export function makeTestEnv(overrides: Partial<Env> = {}): Env {
  const cfEnv = env as unknown as { IMAGES: R2Bucket };
  return Object.freeze({
    IMAGES: cfEnv.IMAGES,
    RATE_LIMITER: stubRateLimiter(true),
    PIXABAY_API_KEY: "test-key",
    ENVIRONMENT: "dev" as const,
    PIXABAY_QUERY: "nature",
    ALLOWED_ORIGINS: "",
    WORKER_HOSTNAME: "localhost:8787",
    ...overrides,
  } as Env);
}

export function makeMetadata(overrides: Partial<ImageMetadata> = {}): ImageMetadata {
  return {
    id: "pixabay-123",
    title: "nature, sky",
    url: "https://localhost:8787/image",
    alt: "nature, sky",
    credit: "Photo by alice on Pixabay",
    license: "Pixabay Content License",
    fetchedAt: "2026-05-19T00:00:00.000Z",
    expiresAt: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

export const FIXED_NOW = new Date("2026-05-19T00:00:00.000Z");
export const fixedClock = () => FIXED_NOW;

export async function clearImages(env: Env): Promise<void> {
  const listed = await env.IMAGES.list();
  await Promise.all(listed.objects.map((obj) => env.IMAGES.delete(obj.key)));
}
