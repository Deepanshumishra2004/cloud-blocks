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
  // Optional. If omitted, derived deterministically from JWT_SECRET. Set
  // explicitly in production so an access-token-only leak cannot be replayed
  // as a refresh token.
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 chars").optional(),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  // Comma-separated list of user IDs granted admin privileges.
  ADMIN_IDS: z.string().optional(),

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

  // ── R2 / Storage ─────────────────────────────────────────────
  S3_BUCKET: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),

  // ── Kubernetes / Repl runtime ────────────────────────────────
  REPL_NAMESPACE: z.string().default("repls"),
  REPL_IMAGE: z.string().default("deepanshumishra2004/execution_layer:latest"),
  REPL_IMAGE_PULL_POLICY: z.enum(["Always", "IfNotPresent", "Never"]).default("Always"),
  K8S_SKIP_TLS_VERIFY: z.coerce.boolean().default(false),
  REPL_BASE_DOMAIN: z.string().default("127.0.0.1.nip.io"),
  REPL_RUNTIME_SECRET: z.string().default("repl-runtime-secrets"),
  REPL_PUBLIC_PROTOCOL: z.enum(["http", "https"]).optional(),
  REPL_PUBLIC_WS_PROTOCOL: z.enum(["ws", "wss"]).optional(),

  // ── AI ───────────────────────────────────────────────────────
  AI_CREDENTIAL_SECRET: z.string().min(32).optional(),

  // ── Email (SMTP via nodemailer) ──────────────────────────────
  // Gmail: enable 2FA, generate App Password at
  //   https://myaccount.google.com/apppasswords
  // SMTP_USER = your gmail address, SMTP_PASS = the 16-char app password.
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
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
