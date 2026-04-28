import { z } from "zod";

/**
 * All env vars are validated at startup. If a required var is missing or
 * malformed the process exits before serving any request — fail fast over fail
 * weird at 3am.
 *
 * Import `env` everywhere instead of reading `process.env` directly.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  // ── Database / Cache ─────────────────────────────────────────
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),

  // ── Auth ─────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  AUTH_COOKIE_DOMAIN: z.string().optional(),

  // ── App URLs ─────────────────────────────────────────────────
  APP_URL: z.string().url().default("http://localhost:3001"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CLIENT_URL: z.string().url().optional(),

  // ── Stripe ───────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // ── OAuth ────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // ── AWS / Storage ────────────────────────────────────────────
  S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default("ap-south-1"),

  // ── Kubernetes / Repl runtime ────────────────────────────────
  REPL_NAMESPACE: z.string().default("repls"),
  REPL_IMAGE: z.string().default("deepanshumishra2004/execution_layer:latest"),
  REPL_BASE_DOMAIN: z.string().default("127.0.0.1.nip.io"),
  REPL_RUNTIME_SECRET: z.string().default("repl-runtime-secrets"),
  REPL_PUBLIC_PROTOCOL: z.enum(["http", "https"]).optional(),
  REPL_PUBLIC_WS_PROTOCOL: z.enum(["ws", "wss"]).optional(),

  // ── AI ───────────────────────────────────────────────────────
  AI_CREDENTIAL_SECRET: z.string().min(32).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("\n❌ Invalid environment variables:\n");
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const isDev = env.NODE_ENV === "development";
