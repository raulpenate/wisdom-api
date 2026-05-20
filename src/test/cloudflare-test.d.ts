declare module "cloudflare:test" {
  // env contains bindings declared in wrangler.jsonc (R2, rate-limit, vars)
  export const env: Record<string, unknown>;
}
