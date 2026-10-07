import { prisma } from "@app/db";
import { buildReminderMessage } from "./buildReminderMessage.js";
import { slotStartInstant } from "@app/shared";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface ReminderDelivery {
  chatId: bigint;
  text: string;
}

export interface ReminderTickOptions {
  now: Date;
  leadMinutes: number;
  /** IANA zone the slots' wall-clock times are expressed in. */
  timeZone: string;
  send: (delivery: ReminderDelivery) => Promise<void>;
  /** Failures for which retrying is pointless (user blocked the bot, chat gone). */
  isPermanentFailure?: (err: unknown) => boolean;
  onError?: (err: unknown, bookingId: string) => void;
}

export interface ReminderTickResult {
  sent: number;
  failed: number;
}

function toUtcDateOnly(instant: number): Date {
  return new Date(Math.floor(instant / DAY_MS) * DAY_MS);
}

export async function runReminderTick(options: ReminderTickOptions): Promise<ReminderTickResult> {
  const { now, leadMinutes, timeZone, send, isPermanentFailure = () => false, onError } = options;
  const nowMs = now.getTime();
  const leadMs = leadMinutes * MINUTE_MS;

  // Slot dates are local calendar days; pad the range by a day on each side so
  // any time zone offset is covered, then filter precisely in memory.
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      reminderSentAt: null,
      slot: {
        date: { gte: toUtcDateOnly(nowMs - DAY_MS), lte: toUtcDateOnly(nowMs + leadMs + DAY_MS) },
      },
    },
    include: { slot: { include: { offer: { include: { restaurant: true } } } } },
  });

  const due = candidates.filter((booking) => {
    const startMs = slotStartInstant(booking.slot.date, booking.slot.startTime, timeZone).getTime();
    const insideWindow = startMs > nowMs && startMs - nowMs <= leadMs;
    // A booking made after the reminder window opened was just confirmed in the
    // app; a reminder minutes later would be noise.
    const bookedBeforeWindow = booking.createdAt.getTime() < startMs - leadMs;
    return insideWindow && bookedBeforeWindow;
  });

  const result: ReminderTickResult = { sent: 0, failed: 0 };

  for (const booking of due) {
    // Atomic claim: only one tick (or bot instance) can flip the flag, which is
    // what guarantees a single reminder across restarts and replicas.
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claim.count === 0) continue;

    try {
      await send({
        chatId: booking.guestTelegramId,
        text: buildReminderMessage({
          restaurantName: booking.slot.offer.restaurant.name,
          offerTitle: booking.slot.offer.title,
          startTime: booking.slot.startTime,
          partySize: booking.partySize,
          discountPercent: booking.slot.discountPercent,
          code: booking.code,
        }),
      });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      onError?.(err, booking.id);
      if (!isPermanentFailure(err)) {
        await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: null } });
      }
    }
  }

  return result;
}
