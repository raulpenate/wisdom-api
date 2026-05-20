import { createApp } from "./app";
import { loadEnv } from "./env";
import { log } from "./lib/log";
import { systemClock } from "./lib/time";
import { refreshDailyImage } from "./services/refresh-service";

const app = createApp();

export default {
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

    ctx.waitUntil(
      refreshDailyImage(env, { fetcher: globalThis.fetch, clock: systemClock }).then((result) => {
        const durationMs = Date.now() - startMs;
        if (result.ok) {
          log({
            level: "info",
            msg: "cron.finished",
            requestId,
            data: { durationMs, outcome: result.value },
          });
        } else {
          log({
            level: "error",
            msg: "cron.finished",
            requestId,
            data: { durationMs, outcome: "failed", code: result.error.code },
          });
        }
      }),
    );
  },
};
