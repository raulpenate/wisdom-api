export type LogLevel = "info" | "warn" | "error";

export type LogFields = {
  readonly level: LogLevel;
  readonly msg: string;
  readonly requestId: string;
  readonly data?: Readonly<Record<string, unknown>>;
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

export function log(fields: LogFields): void {
  const { level, msg, requestId, data } = fields;
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    requestId,
  };
  if (data !== undefined) {
    Object.assign(line, sanitize(data));
  }
  console.log(JSON.stringify(line));
}
