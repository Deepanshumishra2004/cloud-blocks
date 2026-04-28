import pino from "pino";
import { env, isProd } from "../config/env";

/**
 * Structured JSON logger.
 *
 * - Production: raw JSON to stdout for log aggregators (Loki, Datadog, ELK).
 * - Dev / test: pretty-printed via pino-pretty for readable terminal output.
 *
 * Always pass context as the first arg, message as the second:
 *   logger.info({ userId, route }, "user signed in");
 *   logger.error({ err }, "stripe webhook failed");
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : isProd ? "info" : "debug",

  // Strip secrets from any log output (depth-1 keys + nested common spots).
  redact: {
    paths: [
      "password",
      "newPassword",
      "currentPassword",
      "token",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.apiKey",
      "*.api_key",
      "STRIPE_SECRET_KEY",
      "JWT_SECRET",
    ],
    censor: "[REDACTED]",
  },

  // Standard ECS-ish field names so log shippers map correctly.
  base: { service: "cloud-blocks-api" },
  timestamp: pino.stdTimeFunctions.isoTime,

  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service",
          },
        },
      }),
});
