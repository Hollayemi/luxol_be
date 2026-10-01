/*
  Warnings:

  - You are about to drop the column `additionalPhone` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "additionalPhone",
DROP COLUMN "address",
DROP COLUMN "phone",
DROP COLUMN "region",
ADD COLUMN     "addressId" TEXT;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
