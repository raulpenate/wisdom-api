import type { Env } from "../env";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { AppError } from "../types/app-error";

export function rateLimitKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const mappedV4 = ip.match(/(\d{1,3}(\.\d{1,3}){3})$/);
  if (mappedV4?.[1]) return mappedV4[1];
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  const prefix = groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, "") || "0");
  return `${prefix.join(":")}::/64`;
}

export async function checkRateLimit(env: Env, ip: string): Promise<Result<void, AppError>> {
  const { success } = await env.RATE_LIMITER.limit({ key: rateLimitKey(ip) });
  if (!success) {
    return err({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
  }
  return ok(undefined);
}
