/*
  Warnings:

  - Added the required column `userId` to the `Repl` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Repl" ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Repl" ADD CONSTRAINT "Repl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
