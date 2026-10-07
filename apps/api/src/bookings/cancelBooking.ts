import { prisma } from "@app/db";
import { slotStartInstant } from "@app/shared";
import { appTimeZone } from "../config.js";
import { bookingInclude, type BookingWithRelations } from "./createBooking.js";

export interface CancelBookingInput {
  bookingId: string;
  guestTelegramId: bigint;
  /** Injectable clock and zone for tests; default to real time and APP_TIMEZONE. */
  now?: Date;
  timeZone?: string;
}

export type CancelBookingResult =
  | { ok: true; booking: BookingWithRelations }
  | { ok: false; reason: "booking_not_found" | "not_cancellable" | "slot_started" };

const CANCELLABLE_STATUSES = ["pending", "confirmed"] as const;

class CancelFailure extends Error {
  constructor(public reason: "booking_not_found" | "not_cancellable" | "slot_started") {
    super(reason);
  }
}

export async function cancelBooking(input: CancelBookingInput): Promise<CancelBookingResult> {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? appTimeZone;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Scoped to the caller: another guest's booking is indistinguishable from a missing one.
      const existing = await tx.booking.findFirst({
        where: { id: input.bookingId, guestTelegramId: input.guestTelegramId },
        include: { slot: true },
      });
      if (!existing) {
        throw new CancelFailure("booking_not_found");
      }
      if (!CANCELLABLE_STATUSES.includes(existing.status as (typeof CANCELLABLE_STATUSES)[number])) {
        throw new CancelFailure("not_cancellable");
      }
      if (slotStartInstant(existing.slot.date, existing.slot.startTime, timeZone) <= now) {
        throw new CancelFailure("slot_started");
      }

      // Conditional update is the real guard: of several concurrent cancellations
      // only one flips the status, so seats are released exactly once.
      const flipped = await tx.booking.updateMany({
        where: { id: existing.id, status: { in: [...CANCELLABLE_STATUSES] } },
        data: { status: "cancelled" },
      });
      if (flipped.count === 0) {
        throw new CancelFailure("not_cancellable");
      }

      await tx.slot.update({
        where: { id: existing.slotId },
        data: { seatsBooked: { decrement: existing.partySize } },
      });

      return tx.booking.findUniqueOrThrow({ where: { id: existing.id }, include: bookingInclude });
    });

    return { ok: true, booking };
  } catch (err) {
    if (err instanceof CancelFailure) {
      return { ok: false, reason: err.reason };
    }
    throw err;
  }
}
