import { prisma } from "@app/db";
import { buildNewBookingMessage, dayLabel } from "./buildNewBookingMessage.js";

/** Bookings older than this are not announced — after a long outage they are old news. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

export interface StaffDelivery {
  chatId: bigint;
  text: string;
}

export interface StaffNotificationTickOptions {
  now: Date;
  timeZone: string;
  send: (delivery: StaffDelivery) => Promise<void>;
  /** Failures for which retrying is pointless (user blocked the bot, chat gone). */
  isPermanentFailure?: (err: unknown) => boolean;
  onError?: (err: unknown, bookingId: string) => void;
}

export interface StaffNotificationTickResult {
  sent: number;
  failed: number;
}

export async function runStaffNotificationTick(options: StaffNotificationTickOptions): Promise<StaffNotificationTickResult> {
  const { now, timeZone, send, isPermanentFailure = () => false, onError } = options;

  const pending = await prisma.booking.findMany({
    where: {
      staffNotifiedAt: null,
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now },
    },
    include: { slot: { include: { offer: { include: { restaurant: { include: { staff: true } } } } } } },
    orderBy: { createdAt: "asc" },
  });

  const result: StaffNotificationTickResult = { sent: 0, failed: 0 };

  for (const booking of pending) {
    // Atomic claim (outbox pattern): only one tick or bot instance announces a booking.
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, staffNotifiedAt: null },
      data: { staffNotifiedAt: now },
    });
    if (claim.count === 0) continue;

    // Cancelled before anyone was told: nothing to announce.
    if (booking.status !== "pending" && booking.status !== "confirmed") continue;

    const { slot } = booking;
    const text = buildNewBookingMessage({
      day: dayLabel(slot.date.toISOString().slice(0, 10), now, timeZone),
      startTime: slot.startTime,
      offerTitle: slot.offer.title,
      discountPercent: slot.discountPercent,
      partySize: booking.partySize,
      code: booking.code,
    });

    let delivered = 0;
    let retryable = false;
    for (const member of slot.offer.restaurant.staff) {
      try {
        await send({ chatId: member.telegramUserId, text });
        delivered += 1;
      } catch (err) {
        result.failed += 1;
        retryable ||= !isPermanentFailure(err);
        onError?.(err, booking.id);
      }
    }
    result.sent += delivered;

    // Retry only if nobody was reached; once someone has it, a retry would
    // duplicate the message for them.
    if (delivered === 0 && retryable) {
      await prisma.booking.update({ where: { id: booking.id }, data: { staffNotifiedAt: null } });
    }
  }

  return result;
}
