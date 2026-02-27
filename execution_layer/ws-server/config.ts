export const WS_PORT    = Number(process.env.WS_PORT)    || 8080;
export const REPL_ID    = process.env.REPL_ID!;
export const S3_BUCKET  = process.env.S3_BUCKET!;
export const REDIS_URL  = process.env.REDIS_URL!;
export const AWS_REGION = process.env.AWS_REGION         || "us-east-1";
export const WORKSPACE  = "/workspace";