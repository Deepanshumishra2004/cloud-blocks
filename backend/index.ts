// env.ts must be the FIRST import so config validation runs before anything
// else reads process.env.
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
import { csrfMiddleware } from "./middleware/csrfMiddleware";
import { logger } from "./lib/logger";
import { withPrismaRetry } from "./lib/prisma";
import { redis } from "./lib/redis";
import { deleteReplPod } from "./services/k8s.service";

const app = express();

// Trust the first proxy (NGINX ingress / load balancer) so req.ip and
// rate-limit keys reflect the real client, not the load balancer.
app.set("trust proxy", 1);

// Stripe webhook must be mounted before express.json() because it needs the
// raw body for signature verification.
app.use(`${API}${WEBHOOK}`,
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

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
  autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(compression());

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

app.use(`${API}`, csrfMiddleware);
app.use(`${API}`, generalLimiter, apiRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", async (_req, res) => {
  try {
    await Promise.all([
      withPrismaRetry((db) => db.$queryRaw`SELECT 1`),
      redis.ping(),
    ]);
    res.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "readiness check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  process.exit(1);
});

async function reconcileReplStates() {
  try {
    const stale = await withPrismaRetry((db) =>
      db.repl.findMany({
        where: { status: "RUNNING" },
        select: { id: true },
      })
    );

    if (stale.length === 0) return;

    await Promise.all(stale.map((repl) => deleteReplPod(repl.id).catch(() => {})));

    await withPrismaRetry((db) =>
      db.repl.updateMany({
        where: { status: "RUNNING" },
        data: { status: "STOPPED" },
      })
    );

    logger.info({ count: stale.length }, "reconciled stale RUNNING repls to STOPPED");
  } catch (err) {
    logger.error({ err }, "reconcileReplStates failed, continuing startup");
  }
}

app.listen(PORT, async () => {
  logger.info({ port: PORT, base: API }, "server started");
  await reconcileReplStates();
});
