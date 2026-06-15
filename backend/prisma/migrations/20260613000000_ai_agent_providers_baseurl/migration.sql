-- Add new AI providers (China + others) to the AiProvider enum.
-- Postgres requires ADD VALUE outside a transaction; Prisma runs these standalone.
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'QWEN';
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'ZHIPU';
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'KIMI';
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'MINIMAX';

-- Per-credential API base URL override (OpenAI-compatible endpoints).
ALTER TABLE "ai_credentials" ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;
