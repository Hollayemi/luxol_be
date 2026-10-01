-- CreateEnum
CREATE TYPE "MembershipInterval" AS ENUM ('WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "DeliveryFrequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "interval" "MembershipInterval" NOT NULL,
    "deliveryFrequency" "DeliveryFrequency" NOT NULL,
    "supply" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protein" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protein_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "deliveryFrequency" "DeliveryFrequency" NOT NULL,
    "deliveryDay" TEXT NOT NULL,
    "deliveryWindow" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "additionalPhone" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDeliveryAt" TIMESTAMP(3),
    "nextBillingAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "skipUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProteinMixItem" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "proteinId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,

    CONSTRAINT "ProteinMixItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_slug_key" ON "MembershipPlan"("slug");

-- CreateIndex
CREATE INDEX "MembershipPlan_slug_idx" ON "MembershipPlan"("slug");

-- CreateIndex
CREATE INDEX "MembershipPlan_status_idx" ON "MembershipPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Protein_label_key" ON "Protein"("label");

-- CreateIndex
CREATE INDEX "Protein_label_idx" ON "Protein"("label");

-- CreateIndex
CREATE INDEX "Protein_status_idx" ON "Protein"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_nextBillingAt_idx" ON "Subscription"("nextBillingAt");

-- CreateIndex
CREATE INDEX "Subscription_nextDeliveryAt_idx" ON "Subscription"("nextDeliveryAt");

-- CreateIndex
CREATE INDEX "ProteinMixItem_subscriptionId_idx" ON "ProteinMixItem"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProteinMixItem_subscriptionId_proteinId_key" ON "ProteinMixItem"("subscriptionId", "proteinId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProteinMixItem" ADD CONSTRAINT "ProteinMixItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProteinMixItem" ADD CONSTRAINT "ProteinMixItem_proteinId_fkey" FOREIGN KEY ("proteinId") REFERENCES "Protein"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
