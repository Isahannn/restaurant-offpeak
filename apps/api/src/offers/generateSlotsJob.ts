import { prisma } from "@app/db";
import { computeSlotsForOffer } from "./slotGeneration.js";

export interface GenerateSlotsJobOptions {
  horizonDays: number;
  /** "YYYY-MM-DD". Defaults to today (UTC). */
  fromDate?: string;
  /** Restrict generation to a single offer, e.g. after editing its schedule. */
  offerId?: string;
}

export async function generateSlotsJob(options: GenerateSlotsJobOptions): Promise<number> {
  const fromDate = options.fromDate ?? new Date().toISOString().slice(0, 10);
  const offers = await prisma.offer.findMany({
    where: { active: true, ...(options.offerId ? { id: options.offerId } : {}) },
    include: { discountWindows: true },
  });

  let created = 0;

  for (const offer of offers) {
    const candidates = computeSlotsForOffer(
      {
        daysOfWeek: offer.daysOfWeek,
        startTime: offer.startTime,
        endTime: offer.endTime,
        seatsPerSlot: offer.seatsPerSlot,
        discountPercent: offer.discountPercent,
        discountWindows: offer.discountWindows.map((w) => ({
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      },
      { fromDate, days: options.horizonDays },
    );

    if (candidates.length === 0) continue;

    const result = await prisma.slot.createMany({
      data: candidates.map((candidate) => ({
        offerId: offer.id,
        date: new Date(`${candidate.date}T00:00:00.000Z`),
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        seatsTotal: candidate.seatsTotal,
        discountPercent: candidate.discountPercent,
      })),
      skipDuplicates: true,
    });

    created += result.count;
  }

  return created;
}
