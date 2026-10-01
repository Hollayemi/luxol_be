-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'MISSED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "currentDeliveryMarkedAt" TIMESTAMP(3),
ADD COLUMN     "currentDeliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED';
