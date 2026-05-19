import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const validRaw = {
  IMAGES: { get: () => undefined, put: () => undefined, delete: () => undefined },
  RATE_LIMITER: { limit: () => ({ success: true }) },
  PIXABAY_API_KEY: "test-key",
  PIXABAY_QUERY: "nature",
  ALLOWED_ORIGINS: "",
  ENVIRONMENT: "dev",
  WORKER_HOSTNAME: "localhost:8787",
};

describe("loadEnv", () => {
  it("returns a frozen Env on valid input", () => {
    const env = loadEnv(validRaw);
    expect(Object.isFrozen(env)).toBe(true);
    expect(env.PIXABAY_API_KEY).toBe("test-key");
    expect(env.ENVIRONMENT).toBe("dev");
  });

  it("throws when PIXABAY_API_KEY is missing", () => {
    const { PIXABAY_API_KEY: _omit, ...rest } = validRaw;
    expect(() => loadEnv(rest)).toThrow(/Invalid Env/);
  });

  it("throws when PIXABAY_API_KEY is empty", () => {
    expect(() => loadEnv({ ...validRaw, PIXABAY_API_KEY: "" })).toThrow(/Invalid Env/);
  });

  it("throws when ENVIRONMENT is outside the allowed set", () => {
    expect(() => loadEnv({ ...validRaw, ENVIRONMENT: "preprod" })).toThrow(/Invalid Env/);
  });

  it("throws when bindings are missing", () => {
    const { IMAGES: _images, ...rest } = validRaw;
    expect(() => loadEnv(rest)).toThrow(/Invalid Env/);
  });
});
