-- Live updates for the restaurant panel: every new booking and every status
-- change is published on the "booking_events" channel, whoever made it (API,
-- staff, or the bot's auto no-show). Bookkeeping columns such as
-- reminderSentAt/staffNotifiedAt do not fire, so the panel isn't woken for nothing.
CREATE OR REPLACE FUNCTION booking_events_notify() RETURNS trigger AS $$
DECLARE
  restaurant_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;

  SELECT o."restaurantId" INTO restaurant_id
  FROM "Slot" s
  JOIN "Offer" o ON o."id" = s."offerId"
  WHERE s."id" = NEW."slotId";

  PERFORM pg_notify(
    'booking_events',
    json_build_object(
      'restaurantId', restaurant_id,
      'bookingId', NEW."id",
      'type', CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'status_changed' END,
      'status', NEW."status"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_events_notify
AFTER INSERT OR UPDATE OF "status" ON "Booking"
FOR EACH ROW EXECUTE FUNCTION booking_events_notify();
