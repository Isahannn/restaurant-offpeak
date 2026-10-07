-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "staffNotifiedAt" TIMESTAMP(3);

-- Bookings that existed before staff notifications shipped were already seen by
-- staff in the panel; mark them so the bot does not replay the whole history.
UPDATE "Booking" SET "staffNotifiedAt" = "createdAt";
