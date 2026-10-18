-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "meatBoxOrderId" TEXT;

-- CreateTable
CREATE TABLE "MeatBoxCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeatBoxCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeatBoxOption" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "image" TEXT,
    "unit" "MeatBoxUnit" NOT NULL,
    "pricePerKg" DECIMAL(12,2),
    "estimatedMinKg" DECIMAL(10,3),
    "estimatedMaxKg" DECIMAL(10,3),
    "estimatedMinPrice" DECIMAL(12,2),
    "estimatedMaxPrice" DECIMAL(12,2),
    "maxQuantity" INTEGER,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeatBoxOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeatBoxOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT,
    "status" "MeatBoxOrderStatus" NOT NULL DEFAULT 'PENDING_WEIGHING',
    "deliveryFrequency" TEXT NOT NULL,
    "deliveryDay" TEXT NOT NULL,
    "deliveryWindow" TEXT NOT NULL,
    "butcheryGuidelines" TEXT,
    "deliveryAddress" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "estimatedMinTotal" DECIMAL(12,2),
    "estimatedMaxTotal" DECIMAL(12,2),
    "estimatedMinKg" DECIMAL(10,3),
    "estimatedMaxKg" DECIMAL(10,3),
    "confirmedTotal" DECIMAL(12,2),
    "finalWeightKg" DECIMAL(10,3),
    "priceConfirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "nextDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeatBoxOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeatBoxOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" "MeatBoxUnit" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerKg" DECIMAL(12,2),
    "finalWeightKg" DECIMAL(10,3),
    "lineTotal" DECIMAL(12,2),

    CONSTRAINT "MeatBoxOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeatBoxCategory_label_key" ON "MeatBoxCategory"("label");

-- CreateIndex
CREATE UNIQUE INDEX "MeatBoxCategory_slug_key" ON "MeatBoxCategory"("slug");

-- CreateIndex
CREATE INDEX "MeatBoxCategory_slug_idx" ON "MeatBoxCategory"("slug");

-- CreateIndex
CREATE INDEX "MeatBoxCategory_status_idx" ON "MeatBoxCategory"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MeatBoxOption_label_key" ON "MeatBoxOption"("label");

-- CreateIndex
CREATE INDEX "MeatBoxOption_categoryId_idx" ON "MeatBoxOption"("categoryId");

-- CreateIndex
CREATE INDEX "MeatBoxOption_status_idx" ON "MeatBoxOption"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MeatBoxOrder_code_key" ON "MeatBoxOrder"("code");

-- CreateIndex
CREATE INDEX "MeatBoxOrder_userId_idx" ON "MeatBoxOrder"("userId");

-- CreateIndex
CREATE INDEX "MeatBoxOrder_status_idx" ON "MeatBoxOrder"("status");

-- CreateIndex
CREATE INDEX "MeatBoxOrder_createdAt_idx" ON "MeatBoxOrder"("createdAt");

-- CreateIndex
CREATE INDEX "MeatBoxOrderItem_orderId_idx" ON "MeatBoxOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "MeatBoxOrderItem_optionId_idx" ON "MeatBoxOrderItem"("optionId");

-- AddForeignKey
ALTER TABLE "MeatBoxOption" ADD CONSTRAINT "MeatBoxOption_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MeatBoxCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeatBoxOrder" ADD CONSTRAINT "MeatBoxOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeatBoxOrder" ADD CONSTRAINT "MeatBoxOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeatBoxOrderItem" ADD CONSTRAINT "MeatBoxOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MeatBoxOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeatBoxOrderItem" ADD CONSTRAINT "MeatBoxOrderItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MeatBoxOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_meatBoxOrderId_fkey" FOREIGN KEY ("meatBoxOrderId") REFERENCES "MeatBoxOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
