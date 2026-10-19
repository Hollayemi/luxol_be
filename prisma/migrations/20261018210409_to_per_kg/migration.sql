/*
  Warnings:

  - The values [PENDING_WEIGHING,PRICE_CONFIRMED] on the enum `MeatBoxOrderStatus` will be removed.
  - Several columns will be dropped (data lost).
  - Several required columns are being added, which requires backfilling.
*/

-- ============================================================================
-- STEP 0: Handle the enum before anything else.
-- Map any rows that still use the old variants to a valid new variant.
-- ============================================================================

-- Rename the old enum out of the way
ALTER TYPE "MeatBoxOrderStatus" RENAME TO "MeatBoxOrderStatus_old";

-- Create the new enum
CREATE TYPE "MeatBoxOrderStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED'
);

-- Drop the default so the column can be retyped
ALTER TABLE "MeatBoxOrder" ALTER COLUMN "status" DROP DEFAULT;

-- Convert the column to the new type, mapping removed variants to valid ones
ALTER TABLE "MeatBoxOrder"
  ALTER COLUMN "status" TYPE "MeatBoxOrderStatus"
  USING (
    CASE
      WHEN "status"::text IN ('PENDING_WEIGHING', 'PRICE_CONFIRMED') THEN 'PROCESSING'
      ELSE "status"::text
    END
  )::"MeatBoxOrderStatus";

-- Restore the default
ALTER TABLE "MeatBoxOrder" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- Drop the old enum
DROP TYPE "MeatBoxOrderStatus_old";

-- ============================================================================
-- STEP 1: Drop old indexes (safe)
-- ============================================================================
DROP INDEX IF EXISTS "MeatBoxOrder_createdAt_idx";
DROP INDEX IF EXISTS "MeatBoxOrder_status_idx";
DROP INDEX IF EXISTS "MeatBoxOrder_userId_idx";
DROP INDEX IF EXISTS "MeatBoxOrderItem_optionId_idx";
DROP INDEX IF EXISTS "MeatBoxOrderItem_orderId_idx";

-- ============================================================================
-- STEP 2: MeatBoxCategory.pricePerKg (nullable -> backfill -> not null)
-- ============================================================================
ALTER TABLE "MeatBoxCategory" ADD COLUMN "pricePerKg" DECIMAL(12,2);
UPDATE "MeatBoxCategory" SET "pricePerKg" = 0 WHERE "pricePerKg" IS NULL;
ALTER TABLE "MeatBoxCategory" ALTER COLUMN "pricePerKg" SET NOT NULL;

-- ============================================================================
-- STEP 3: MeatBoxOption — drop old cols, add weightKg safely
-- ============================================================================
ALTER TABLE "MeatBoxOption"
  DROP COLUMN "estimatedMaxKg",
  DROP COLUMN "estimatedMaxPrice",
  DROP COLUMN "estimatedMinKg",
  DROP COLUMN "estimatedMinPrice",
  DROP COLUMN "pricePerKg",
  DROP COLUMN "unit";

ALTER TABLE "MeatBoxOption" ADD COLUMN "weightKg" DECIMAL(10,3);
UPDATE "MeatBoxOption" SET "weightKg" = 0 WHERE "weightKg" IS NULL;
ALTER TABLE "MeatBoxOption" ALTER COLUMN "weightKg" SET NOT NULL;

-- ============================================================================
-- STEP 4: MeatBoxOrder — drops, add deliveryFee/subtotal/total safely
-- ============================================================================
ALTER TABLE "MeatBoxOrder"
  DROP COLUMN "confirmedTotal",
  DROP COLUMN "estimatedMaxKg",
  DROP COLUMN "estimatedMaxTotal",
  DROP COLUMN "estimatedMinKg",
  DROP COLUMN "estimatedMinTotal",
  DROP COLUMN "finalWeightKg",
  DROP COLUMN "priceConfirmedAt";

-- deliveryFee has a DEFAULT 0, so it is safe to add as NOT NULL directly
ALTER TABLE "MeatBoxOrder" ADD COLUMN "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- subtotal: add nullable, backfill, then NOT NULL
ALTER TABLE "MeatBoxOrder" ADD COLUMN "subtotal" DECIMAL(12,2);
UPDATE "MeatBoxOrder" SET "subtotal" = 0 WHERE "subtotal" IS NULL;
ALTER TABLE "MeatBoxOrder" ALTER COLUMN "subtotal" SET NOT NULL;

-- total: add nullable, backfill, then NOT NULL
ALTER TABLE "MeatBoxOrder" ADD COLUMN "total" DECIMAL(12,2);
UPDATE "MeatBoxOrder" SET "total" = 0 WHERE "total" IS NULL;
ALTER TABLE "MeatBoxOrder" ALTER COLUMN "total" SET NOT NULL;

-- status default is already restored above; ensure it's PENDING_PAYMENT
ALTER TABLE "MeatBoxOrder" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- ============================================================================
-- STEP 5: MeatBoxOrderItem — drops, add weightKg, fix NULLs on pricePerKg/lineTotal
-- ============================================================================
ALTER TABLE "MeatBoxOrderItem"
  DROP COLUMN "finalWeightKg",
  DROP COLUMN "unit";

-- weightKg: add nullable, backfill, then NOT NULL
ALTER TABLE "MeatBoxOrderItem" ADD COLUMN "weightKg" DECIMAL(10,3);
UPDATE "MeatBoxOrderItem" SET "weightKg" = 0 WHERE "weightKg" IS NULL;
ALTER TABLE "MeatBoxOrderItem" ALTER COLUMN "weightKg" SET NOT NULL;

-- pricePerKg: there are 7 existing NULLs — backfill before SET NOT NULL
UPDATE "MeatBoxOrderItem" SET "pricePerKg" = 0 WHERE "pricePerKg" IS NULL;
ALTER TABLE "MeatBoxOrderItem" ALTER COLUMN "pricePerKg" SET NOT NULL;

-- lineTotal: there are 2 existing NULLs — backfill before SET NOT NULL
UPDATE "MeatBoxOrderItem" SET "lineTotal" = 0 WHERE "lineTotal" IS NULL;
ALTER TABLE "MeatBoxOrderItem" ALTER COLUMN "lineTotal" SET NOT NULL;