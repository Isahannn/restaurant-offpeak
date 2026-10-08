-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('code', 'manual');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checkInMethod" "CheckInMethod",
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "guestNotifiedStatusAt" TIMESTAMP(3);

-- Visits marked before this feature were never announced to guests; mark them
-- as already notified so the bot does not message people about old visits.
UPDATE "Booking" SET "guestNotifiedStatusAt" = "updatedAt" WHERE "status" IN ('arrived', 'no_show');
