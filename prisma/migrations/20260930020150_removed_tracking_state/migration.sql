/*
  Warnings:

  - The values [IN_PROGRESS,COMPLETED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `OrderTrackStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OrderStepId" AS ENUM ('PLACED', 'PAYMENT', 'PACKED', 'OUT_FOR_DELIVERY', 'RECEIVED', 'RATE');

-- CreateEnum
CREATE TYPE "OrderStepState" AS ENUM ('DONE', 'ACTIVE', 'PENDING');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "OrderTrackStep" DROP CONSTRAINT "OrderTrackStep_orderId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "timeline" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropTable
DROP TABLE "OrderTrackStep";

-- DropEnum
DROP TYPE "TrackStepId";

-- DropEnum
DROP TYPE "TrackStepState";
