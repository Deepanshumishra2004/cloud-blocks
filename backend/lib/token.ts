// src/lib/token.ts
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/user.type";
import { env } from "../config/env";

const EXPIRES = "7d";

export function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: EXPIRES });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}