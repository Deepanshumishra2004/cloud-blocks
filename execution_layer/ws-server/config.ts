export const WS_PORT      = Number(process.env.WS_PORT) || 8080;
export const PREVIEW_PORT = 3002;
export const REPL_ID      = process.env.REPL_ID!;
export const REPL_TYPE    = process.env.REPL_TYPE?.toLowerCase() || "";
export const S3_BUCKET    = process.env.S3_BUCKET!;
export const REDIS_URL    = process.env.REDIS_URL!;
export const AWS_REGION   = process.env.AWS_REGION || "ap-south-1";
export const WORKSPACE    = "/workspace";

export const TEMPLATE_APP_PORTS: Record<string, number> = {
  react:      5173,
  next:       3000,
  node:       3000,
  bun:        3000,
  javascript: 3000,
};
