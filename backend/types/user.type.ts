// src/types/user.type.ts
import { z } from "zod";

/* ─── Email / Password ───────────────────────────────────── */
export const SignupSchema = z.object({
  email:    z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password too long"),
});

export const SigninSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(1, "Password required"),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type SigninInput = z.infer<typeof SigninSchema>;

/* ─── OAuth state / callback ─────────────────────────────── */
export const OAuthCallbackSchema = z.object({
  code:  z.string(),
  state: z.string().optional(),
});

/* ─── JWT payload ────────────────────────────────────────── */
export interface JwtPayload {
  userId: string;
  iat?:   number;
  exp?:   number;
}