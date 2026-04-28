import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/AppError";
import { isProd } from "../config/env";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound("Route not found"));
}

// 4-arg signature is required for Express to recognize this as an error handler.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // 1) AppError — already shaped
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.code,
      ...(err.details ? { errors: err.details } : {}),
    });
  }

  // 2) Zod validation
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: err.flatten().fieldErrors,
    });
  }

  // 3) Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        message: "Resource already exists",
        code: "DUPLICATE",
        target: err.meta?.target,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Resource not found", code: "NOT_FOUND" });
    }
    return res.status(400).json({
      message: "Database request error",
      code: err.code,
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ message: "Invalid database query", code: "DB_VALIDATION" });
  }

  // 4) JSON body parse errors
  // @ts-expect-error - express raises SyntaxError with a `body` prop
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Malformed JSON body", code: "BAD_JSON" });
  }

  // 5) Unknown — log full, respond generic.
  // pino-http attaches a request-scoped logger as req.log so the requestId is preserved.
  const log = (req as any).log ?? console;
  log.error({ err, method: req.method, url: req.originalUrl }, "unhandled error");

  return res.status(500).json({
    message: isProd ? "Internal server error" : (err as Error)?.message ?? "Internal server error",
    code: "INTERNAL",
    ...(isProd ? {} : { stack: (err as Error)?.stack }),
  });
}
