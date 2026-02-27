import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(20)
});

export const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
