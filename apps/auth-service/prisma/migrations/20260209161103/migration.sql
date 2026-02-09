-- CreateTable
CREATE TABLE "passwordResets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passwordResets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "passwordResets_userId_idx" ON "passwordResets"("userId");

-- AddForeignKey
ALTER TABLE "passwordResets" ADD CONSTRAINT "passwordResets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
