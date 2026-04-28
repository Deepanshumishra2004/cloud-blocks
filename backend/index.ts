// env.ts must be the FIRST import — it validates and exits on bad config
// before any other module reads process.env.
import { env } from "./config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import crypto from "crypto";
import { PORT, API, WEBHOOK } from "./config/config";
import apiRoutes from "./routes/routes";
import { handleStripeWebhook } from "./controller/webhook.controller";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimiters";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

const app = express();

// Trust the first proxy (NGINX ingress / load balancer) so req.ip and
// rate-limit keys reflect the real client, not the LB.
app.set("trust proxy", 1);

// Stripe webhook must be mounted BEFORE express.json() — needs the raw body.
// Also mounted before helmet/compression so headers don't interfere with signature verification.
app.use(`${API}${WEBHOOK}`,
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Per-request logger: assigns a request id, logs method/url/status/latency.
app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-request-id"];
    const id = (Array.isArray(incoming) ? incoming[0] : incoming) ?? crypto.randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Don't log noisy health checks at info level
  autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
}));

app.use(helmet({
  contentSecurityPolicy: false, // API is JSON-only; CSP belongs on the frontend
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(compression());

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

// Broad ceiling on every API request. Per-route limiters add stricter caps where needed.
app.use(`${API}`, generalLimiter, apiRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", async (_req, res) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    res.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "readiness check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

// 404 + global error handler — MUST be the last middleware in the chain.
app.use(notFoundHandler);
app.use(errorHandler);

// Crash-safe: log and let the process manager (K8s/PM2) restart on hard failure.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info({ port: PORT, base: API }, "server started");
});
