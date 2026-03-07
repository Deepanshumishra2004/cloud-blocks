// src/lib/token.ts
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/user.type";

const SECRET  = process.env.JWT_SECRET as string;
const EXPIRES = "7d";

if (!SECRET) throw new Error("JWT_SECRET is not set in environment");

export function signToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: EXPIRES });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}