-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DiscountWindow" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "DiscountWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountWindow_offerId_idx" ON "DiscountWindow"("offerId");

-- AddForeignKey
ALTER TABLE "DiscountWindow" ADD CONSTRAINT "DiscountWindow_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
