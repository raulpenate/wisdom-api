# Observability

You can't fix what you can't see. Logs are the entire observability story for this service in v1 — no metrics backend, no APM. That means logs must be **structured, sparse, and correlated**.

## Format

One format, everywhere: a single JSON object per line, written via `console.log`. Workers Logs ingests it automatically.

```ts
function log(env: Env, fields: LogFields): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: fields.level,
    msg: fields.msg,
    requestId: fields.requestId,
    ...fields.data,
  }));
}
```

Required fields on every line:

| Field       | Type                          | Notes                                         |
| ----------- | ----------------------------- | --------------------------------------------- |
| `ts`        | ISO-8601 string               | Generated at log call site                    |
| `level`     | `"info" \| "warn" \| "error"` | No `debug` in production                      |
| `msg`       | string                        | Short, lowercase, no variables interpolated   |
| `requestId` | string (UUID)                 | Always present; for cron, use a per-run UUID  |

Additional structured fields go under their own keys — never concatenated into `msg`. **Good:** `{ "msg": "image_served", "ageSeconds": 1234 }`. **Bad:** `{ "msg": "image served after 1234s" }`.

## Request correlation

- Generate `requestId = crypto.randomUUID()` at the route entry.
- Store on Hono context: `c.set("requestId", requestId)`.
- Echo in `X-Request-Id` response header (every response, including errors).
- Include in the JSON error envelope's `error.requestId`.
- Pass into every service/repository call that might log.

For cron handlers: generate a `requestId` at the start of the scheduled run; reuse it for every log line in that run.

## When to log

- **Once per request, at the route boundary.** Log the outcome (success or failure) after the response is built. Internal services/repositories do not log — they return `Result`s. This rule keeps logs proportional to traffic and trivially searchable.
- **Exception:** cron handlers log start (`cron.started`), end (`cron.finished`), and any non-recoverable error inside the run.
- **Exception:** unhandled errors caught by the top-level error handler are logged at `error` with `code: "INTERNAL"` and full `cause`.

Do not log inside loops. Do not log inside hot retry paths.

## Levels

| Level   | When                                                                 |
| ------- | -------------------------------------------------------------------- |
| `info`  | Successful request, expected domain error (4xx returned to client)   |
| `warn`  | Recovered upstream failure, near-quota events, deprecated input shapes |
| `error` | `INTERNAL` errors (i.e. bugs), 5xx responses, cron failures          |

4xx is `info` because it's the system working correctly. 5xx is `error` because it isn't.

## Never log

- Secrets: API keys, tokens, anything from `env` whose name implies sensitivity.
- Authorization/cookie headers: omit entirely; do not even include the key with a redacted value.
- Full request bodies or response bodies.
- Raw `env` object (`console.log(env)` is banned).
- Stack traces that include user-supplied data verbatim. Log `error.cause.message` and `error.cause.name`, not the full `error.cause`.
- IPs in clear text if we ever add user accounts. Until then, `cf-connecting-ip` is acceptable because the service is anonymous.

## Sampling

100% in v1. We expect very low cardinality (one route, one cron). Add sampling only when Workers Logs cost becomes material.

## Cron handlers

Every scheduled run produces exactly two log lines on the happy path:

```json
{"ts":"...","level":"info","msg":"cron.started","requestId":"...","schedule":"0 0 * * *"}
{"ts":"...","level":"info","msg":"cron.finished","requestId":"...","durationMs":1842,"outcome":"refreshed"}
```

And one additional `error` line if the run fails. A cron that produces zero lines is broken.
