CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK');

CREATE TABLE "ai_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_credentials_userId_provider_name_key" ON "ai_credentials"("userId", "provider", "name");
CREATE INDEX "ai_credentials_userId_isActive_idx" ON "ai_credentials"("userId", "isActive");

ALTER TABLE "ai_credentials"
ADD CONSTRAINT "ai_credentials_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
