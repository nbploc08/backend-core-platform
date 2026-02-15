/*
  Warnings:

  - Changed the type of `status` on the `idempotency_records` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "idempotency_records" DROP COLUMN "status",
ADD COLUMN     "status" "IdempotencyStatus" NOT NULL;

-- CreateIndex
CREATE INDEX "idempotency_records_status_idx" ON "idempotency_records"("status");
