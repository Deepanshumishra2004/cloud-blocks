import cron from "node-cron";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { stopRepl } from "../services/repl.service";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export async function checkIdleRepls(): Promise<void> {
  const runningRepls = await redis.smembers("repls:running");

  for (const replId of runningRepls) {
    const lastActive = await redis.get(`repl:active:${replId}`);

    if (!lastActive || Date.now() - Number(lastActive) > IDLE_TIMEOUT_MS) {
      logger.info({ replId }, "cron: idle shutdown");
      await stopRepl(replId).catch((err) => logger.error({ err, replId }, "cron: stopRepl failed"));
    }
  }
}

// Only schedule when run directly: `bun worker/cron.ts`
if (import.meta.main) {
  cron.schedule("* * * * *", checkIdleRepls);
  logger.info("cron: idle detection running");
}
