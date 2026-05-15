export const WS_PORT        = Number(process.env.WS_PORT) || 8080;
export const PREVIEW_PORT   = 3002;   // port the ws-server proxy listens on
export const REPL_ID        = process.env.REPL_ID!;
export const REPL_TYPE      = process.env.REPL_TYPE?.toLowerCase() || "";
export const USER_ID        = process.env.USER_ID!;
export const S3_BUCKET      = process.env.S3_BUCKET!;
export const REDIS_URL      = process.env.REDIS_URL!;
export const R2_ACCOUNT_ID  = process.env.R2_ACCOUNT_ID!;
export const WORKSPACE      = "/workspace";
// External URL clients use to access the preview (passed in by the backend at pod creation time)
export const PREVIEW_URL    = process.env.PREVIEW_URL ?? "";

// Native port each template's dev server listens on inside the container.
// The ws-server proxy forwards PREVIEW_PORT → these ports.
export const TEMPLATE_APP_PORTS: Record<string, number> = {
  react:      5173,
  next:       3000,
  node:       3000,
  bun:        3000,
  javascript: 3000,
};
