/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `emailOtps` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "emailOtps_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "emailOtps_userId_key" ON "emailOtps"("userId");
