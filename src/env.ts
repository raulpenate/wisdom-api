import { z } from "zod";

export interface Env {
  readonly IMAGES: R2Bucket;
  readonly RATE_LIMITER: RateLimit;
  readonly PIXABAY_API_KEY: string;
  readonly PIXABAY_QUERY: string;
  readonly ALLOWED_ORIGINS: string;
  readonly ENVIRONMENT: "dev" | "staging" | "prod";
  readonly WORKER_HOSTNAME: string;
}

const r2BucketLike = z.custom<R2Bucket>(
  (value) => value != null && typeof (value as R2Bucket).get === "function",
  { message: "expected R2Bucket binding" },
);

const rateLimitLike = z.custom<RateLimit>(
  (value) => value != null && typeof (value as RateLimit).limit === "function",
  { message: "expected RateLimit binding" },
);

const EnvSchema = z.object({
  IMAGES: r2BucketLike,
  RATE_LIMITER: rateLimitLike,
  PIXABAY_API_KEY: z.string().min(1),
  PIXABAY_QUERY: z.string().min(1),
  ALLOWED_ORIGINS: z.string(),
  ENVIRONMENT: z.enum(["dev", "staging", "prod"]),
  WORKER_HOSTNAME: z.string().min(1),
});

export function loadEnv(raw: unknown): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid Env: ${parsed.error.message}`);
  }
  return Object.freeze(parsed.data) as Env;
}
