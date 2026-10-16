import * as Sentry from "@sentry/cloudflare";
import { createApp } from "./app";
import { loadEnv } from "./env";
import { log } from "./lib/log";
import { systemClock } from "./lib/time";
import { refreshDailyImages } from "./services/refresh-service";

const app = createApp();

const REFRESH_CRON = "*/15 * * * *";

export const sentryOptions = (raw: { SENTRY_DSN?: string; ENVIRONMENT?: string }) => ({
  ...(raw.SENTRY_DSN ? { dsn: raw.SENTRY_DSN } : {}),
  ...(raw.ENVIRONMENT ? { environment: raw.ENVIRONMENT } : {}),
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  tracesSampleRate: 0,
  beforeSend(event: Sentry.ErrorEvent) {
    delete event.user;
    return event;
  },
});

const handler = {
  async fetch(req: Request, raw: unknown, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(req, loadEnv(raw), ctx);
  },

  async scheduled(
    controller: ScheduledController,
    raw: unknown,
    ctx: ExecutionContext,
  ): Promise<void> {
    const env = loadEnv(raw);
    const requestId = crypto.randomUUID();

    log({
      level: "info",
      msg: "cron.started",
      requestId,
      data: { schedule: controller.cron },
    });

    const startMs = Date.now();

    const run = async () => {
      const result = await refreshDailyImages(env, {
        fetcher: globalThis.fetch,
        clock: systemClock,
      });
      const durationMs = Date.now() - startMs;
      if (result.ok) {
        log({
          level: result.value.failed.length > 0 ? "warn" : "info",
          msg: "cron.finished",
          requestId,
          data: { durationMs, ...result.value },
        });
        return;
      }
      log({
        level: "error",
        msg: "cron.finished",
        requestId,
        data: { durationMs, outcome: "failed", code: result.error.code },
      });
      throw new Error(`daily wallpaper refresh failed: ${result.error.code}`);
    };

    ctx.waitUntil(
      Sentry.withMonitor("daily-wallpapers", run, {
        schedule: { type: "crontab", value: REFRESH_CRON },
        checkinMargin: 5,
        maxRuntime: 5,
        timezone: "Etc/UTC",
      }).catch(() => undefined),
    );
  },
} satisfies ExportedHandler;

export default Sentry.withSentry(sentryOptions, handler);
