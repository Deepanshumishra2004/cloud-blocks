/*
  Warnings:

  - You are about to drop the column `language` on the `Repl` table. All the data in the column will be lost.
  - Added the required column `type` to the `Repl` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReplType" AS ENUM ('NODE', 'REACT', 'NEXT');

-- AlterTable
ALTER TABLE "Repl" DROP COLUMN "language",
ADD COLUMN     "type" "ReplType" NOT NULL;
