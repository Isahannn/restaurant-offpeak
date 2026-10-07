import { Prisma, prisma } from "@app/db";
import { slotStartInstant } from "@app/shared";
import { appTimeZone } from "../config.js";
import { generateBookingCode } from "./generateBookingCode.js";

export interface CreateBookingInput {
  slotId: string;
  guestTelegramId: bigint;
  partySize: number;
  /** Injectable clock and zone for tests; default to real time and APP_TIMEZONE. */
  now?: Date;
  timeZone?: string;
}

const bookingInclude = {
  slot: {
    include: {
      offer: {
        include: {
          restaurant: true,
        },
      },
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export type CreateBookingResult =
  | { ok: true; booking: BookingWithRelations }
  | { ok: false; reason: "invalid_party_size" | "slot_not_found" | "slot_started" | "sold_out" };

const MAX_CODE_ATTEMPTS = 5;

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  if (!Number.isInteger(input.partySize) || input.partySize < 1) {
    return { ok: false, reason: "invalid_party_size" };
  }

  // A booking-code collision aborts the Postgres transaction, so each retry must
  // run a fresh transaction; the seat reservation rolls back with the failed one.
  for (let attempt = 1; ; attempt++) {
    try {
      const booking = await reserveSeatsAndBook(input, generateBookingCode());
      return { ok: true, booking };
    } catch (err) {
      if (err instanceof KnownFailure) {
        return { ok: false, reason: err.reason };
      }
      if (isUniqueConstraintError(err) && attempt < MAX_CODE_ATTEMPTS) {
        continue;
      }
      throw err;
    }
  }
}

function reserveSeatsAndBook(input: CreateBookingInput, code: string): Promise<BookingWithRelations> {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? appTimeZone;

  return prisma.$transaction(async (tx) => {
    const updatedCount = await tx.$executeRaw`
      UPDATE "Slot"
      SET "seatsBooked" = "seatsBooked" + ${input.partySize}
      WHERE "id" = ${input.slotId}
        AND "seatsBooked" + ${input.partySize} <= "seatsTotal"
        AND EXISTS (SELECT 1 FROM "Offer" WHERE "Offer"."id" = "Slot"."offerId" AND "Offer"."active")
        AND ("date" + "startTime"::time) AT TIME ZONE ${timeZone} > ${now}::timestamptz
    `;

    if (updatedCount === 0) {
      const slot = await tx.slot.findUnique({
        where: { id: input.slotId },
        include: { offer: { select: { active: true } } },
      });
      if (!slot || !slot.offer.active) {
        throw new KnownFailure("slot_not_found");
      }
      if (slotStartInstant(slot.date, slot.startTime, timeZone) <= now) {
        throw new KnownFailure("slot_started");
      }
      throw new KnownFailure("sold_out");
    }

    return tx.booking.create({
      data: {
        slotId: input.slotId,
        guestTelegramId: input.guestTelegramId,
        partySize: input.partySize,
        code,
        status: "confirmed",
      },
      include: bookingInclude,
    });
  });
}

class KnownFailure extends Error {
  constructor(public reason: "slot_not_found" | "slot_started" | "sold_out") {
    super(reason);
  }
}
