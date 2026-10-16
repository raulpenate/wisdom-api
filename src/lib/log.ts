import { captureException, captureMessage } from "@sentry/cloudflare";

export type LogLevel = "info" | "warn" | "error";

export type LogFields = {
  readonly level: LogLevel;
  readonly msg: string;
  readonly requestId: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly error?: unknown;
};

const BANNED_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "pixabay_api_key",
  "password",
  "token",
  "secret",
]);

function sanitize(data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (BANNED_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

function report(
  level: LogLevel,
  msg: string,
  requestId: string,
  data: Record<string, unknown> | undefined,
  error: unknown,
): void {
  if (level === "info") return;
  const context = {
    level: level === "warn" ? ("warning" as const) : ("error" as const),
    tags: { requestId },
    ...(data === undefined ? {} : { extra: data }),
  };
  if (error === undefined) captureMessage(msg, context);
  else captureException(error, context);
}

export function log(fields: LogFields): void {
  const { level, msg, requestId, data, error } = fields;
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    requestId,
  };
  const safeData = data === undefined ? undefined : sanitize(data);
  if (safeData !== undefined) {
    Object.assign(line, safeData);
  }
  console.log(JSON.stringify(line));
  report(level, msg, requestId, safeData, error);
}
