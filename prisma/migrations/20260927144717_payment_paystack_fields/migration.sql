/*
  Warnings:

  - You are about to drop the column `addressId` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryMethod` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `promoCodeId` on the `Cart` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_addressId_fkey";

-- DropForeignKey
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_promoCodeId_fkey";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "addressId",
DROP COLUMN "deliveryMethod",
DROP COLUMN "promoCodeId";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "accessCode" TEXT,
ADD COLUMN     "authorizationUrl" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);
