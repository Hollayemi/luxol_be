-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "isOpened" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
