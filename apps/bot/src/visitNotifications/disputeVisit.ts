import { prisma } from "@app/db";

export type DisputeResult = "disputed" | "already_disputed" | "not_found";

/**
 * The guest says the restaurant's mark is wrong. Only the booking's own guest
 * can dispute, and only an arrived / no-show mark. Idempotent: pressing the
 * button twice is fine.
 */
export async function disputeVisit(bookingId: string, guestTelegramId: bigint, now: Date): Promise<DisputeResult> {
  const updated = await prisma.booking.updateMany({
    where: { id: bookingId, guestTelegramId, status: { in: ["arrived", "no_show"] }, disputedAt: null },
    data: { disputedAt: now },
  });
  if (updated.count === 1) return "disputed";

  const existing = await prisma.booking.findFirst({
    where: { id: bookingId, guestTelegramId, status: { in: ["arrived", "no_show"] } },
    select: { disputedAt: true },
  });
  return existing?.disputedAt ? "already_disputed" : "not_found";
}
