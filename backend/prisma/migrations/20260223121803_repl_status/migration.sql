-- CreateEnum
CREATE TYPE "ReplStatusType" AS ENUM ('RUNNING', 'STOPPED');

-- AlterTable
ALTER TABLE "Repl" ADD COLUMN     "status" "ReplStatusType" NOT NULL DEFAULT 'STOPPED';
