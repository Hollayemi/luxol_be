-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CustomerActivityType" AS ENUM ('ORDER_PLACED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'POINTS_REDEEMED', 'POINTS_EARNED', 'MEMBERSHIP_SUBSCRIBED', 'MEMBERSHIP_CANCELLED', 'ADDRESS_ADDED', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerStatus" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "CustomerActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CustomerActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerActivity_userId_occurredAt_idx" ON "CustomerActivity"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
