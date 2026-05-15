// src/services/email.service.ts
//
// SMTP delivery via nodemailer. Configured via SMTP_USER / SMTP_PASS env vars
// (Gmail App Password works out of the box). If creds are missing we log the
// would-have-sent payload so local dev still works without SMTP — the caller
// path (forgot-password) treats send failures as non-fatal anyway.

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../lib/logger";

let transporter: Transporter | null = null;

if (env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
} else {
  logger.warn("[email] SMTP not configured — emails will be logged, not sent");
}

const FROM = env.EMAIL_FROM ?? env.SMTP_USER ?? "noreply@localhost";

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    logger.info({ to, subject, html }, "[email] (mock send — SMTP unconfigured)");
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info({ to, subject }, "[email] sent");
  } catch (err) {
    logger.error({ err, to, subject }, "[email] send failed");
    // Swallow — callers (e.g. forgot-password) return generic 200 anyway
    // for anti-enumeration. Don't leak transport state to the client.
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await send(
    to,
    "Reset your password",
    `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="margin:0 0 16px;font-size:20px">Reset your password</h2>
        <p style="margin:0 0 16px;line-height:1.5">
          A password reset was requested for your account. Click the button below to set a new password. The link expires in 15 minutes.
        </p>
        <p style="margin:0 0 24px">
          <a href="${resetUrl}" style="display:inline-block;background:#5b8def;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">
            Reset password
          </a>
        </p>
        <p style="margin:0 0 6px;font-size:13px;color:#666">Or paste this link into your browser:</p>
        <p style="margin:0;font-size:12px;color:#666;word-break:break-all">${resetUrl}</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
        <p style="margin:0;font-size:12px;color:#999">
          If you didn't request this, ignore this email — your password stays the same.
        </p>
      </div>
    `,
  );
}
