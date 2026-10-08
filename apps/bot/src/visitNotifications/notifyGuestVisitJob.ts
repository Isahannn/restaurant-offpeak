import { prisma } from "@app/db";
import { dayLabel } from "../staffNotifications/buildNewBookingMessage.js";
import { buildVisitMessage } from "./buildVisitMessage.js";

/** Marks older than this are not announced — after a long outage they are old news. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

export interface VisitDelivery {
  chatId: bigint;
  text: string;
  bookingId: string;
  disputeLabel: string;
}

export interface GuestVisitTickOptions {
  now: Date;
  timeZone: string;
  send: (delivery: VisitDelivery) => Promise<void>;
  /** Failures for which retrying is pointless (user blocked the bot, chat gone). */
  isPermanentFailure?: (err: unknown) => boolean;
  onError?: (err: unknown, bookingId: string) => void;
}

/**
 * Tells the guest how their visit was marked ("thanks for coming" / "looks
 * like you missed it") with a button to dispute it — the guest's safeguard
 * against a restaurant marking visits that never happened. Outbox semantics:
 * exactly one message per mark, retried on transient failures.
 */
export async function runGuestVisitTick(options: GuestVisitTickOptions): Promise<{ sent: number; failed: number }> {
  const { now, timeZone, send, isPermanentFailure = () => false, onError } = options;

  const pending = await prisma.booking.findMany({
    where: {
      status: { in: ["arrived", "no_show"] },
      guestNotifiedStatusAt: null,
      updatedAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now },
    },
    include: { slot: { include: { offer: { include: { restaurant: true } } } } },
    orderBy: { updatedAt: "asc" },
  });

  const result = { sent: 0, failed: 0 };

  for (const booking of pending) {
    // Claim only while the status is still the one we are about to announce.
    // Raw SQL on purpose: Prisma would bump updatedAt, and updatedAt is the
    // time of the visit mark this job's 24h window is measured from.
    const claimed = await prisma.$executeRaw`
      UPDATE "Booking" SET "guestNotifiedStatusAt" = ${now}
      WHERE "id" = ${booking.id} AND "guestNotifiedStatusAt" IS NULL AND "status"::text = ${booking.status}
    `;
    if (claimed === 0) continue;

    const { slot } = booking;
    const message = buildVisitMessage({
      status: booking.status as "arrived" | "no_show",
      restaurantName: slot.offer.restaurant.name,
      offerTitle: slot.offer.title,
      day: dayLabel(slot.date.toISOString().slice(0, 10), now, timeZone),
      startTime: slot.startTime,
      discountPercent: slot.discountPercent,
    });

    try {
      await send({ chatId: booking.guestTelegramId, text: message.text, bookingId: booking.id, disputeLabel: message.disputeLabel });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      onError?.(err, booking.id);
      if (!isPermanentFailure(err)) {
        await prisma.$executeRaw`UPDATE "Booking" SET "guestNotifiedStatusAt" = NULL WHERE "id" = ${booking.id}`;
      }
    }
  }

  return result;
}
