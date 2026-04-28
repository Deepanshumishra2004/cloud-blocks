// K8s CronJob entry point — runs the idle check once then exits.
import { checkIdleRepls } from "./cron";
import { logger } from "../lib/logger";
import { redis } from "../lib/redis";

try {
  await checkIdleRepls();
  logger.info("cron-runner: idle check complete");
} catch (err) {
  logger.error({ err }, "cron-runner: idle check failed");
  process.exit(1);
} finally {
  await redis.quit();
}
