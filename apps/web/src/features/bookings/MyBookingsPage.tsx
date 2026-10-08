import type { BookingConfirmationDto } from "@app/shared";
import { invalidate, useApi } from "../../api/useApi";
import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { useNow } from "../../hooks/useNow";
import { bookingPhase } from "./bookingPhase";
import { MyBookingCard } from "./MyBookingCard";

export function MyBookingsPage() {
  const state = useApi<{ bookings: BookingConfirmationDto[] }>("/bookings/me");
  // Re-evaluate every 30s so cancel links and statuses change while the page stays open.
  const now = useNow(30_000);

  // A cancellation frees seats, so the feed and restaurant pages are stale too.
  const onChange = () => invalidate("/bookings/me", "/offers", "/restaurants");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>Мои брони</h1>

      {state.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Skeleton height={140} radius="var(--radius-lg)" />
          <Skeleton height={140} radius="var(--radius-lg)" />
        </div>
      )}

      {state.status === "error" && (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Не удалось загрузить брони</p>
          <Button variant="secondary" onClick={state.reload}>
            Повторить
          </Button>
        </div>
      )}

      {state.status === "ready" && state.data.bookings.length === 0 && (
        <p style={{ margin: "var(--space-5) 0", textAlign: "center", color: "var(--color-text-muted)" }}>
          Здесь появятся ваши брони — выберите столик в ленте
        </p>
      )}

      {state.status === "ready" && state.data.bookings.length > 0 && (
        <>
          <BookingSection
            title="Предстоящие"
            bookings={state.data.bookings
              .filter((b) => isUpcoming(b, now))
              .sort((a, b) => startKey(a).localeCompare(startKey(b)))}
            now={now}
            onChange={onChange}
          />
          <BookingSection
            title="Прошедшие"
            bookings={state.data.bookings
              .filter((b) => !isUpcoming(b, now))
              .sort((a, b) => startKey(b).localeCompare(startKey(a)))}
            now={now}
            onChange={onChange}
          />
        </>
      )}
    </div>
  );
}

function startKey(booking: BookingConfirmationDto): string {
  return `${booking.slotDate} ${booking.slotStartTime}`;
}

/** Active bookings that haven't finished yet; everything else is history. */
function isUpcoming(booking: BookingConfirmationDto, now: number): boolean {
  const active = booking.status === "pending" || booking.status === "confirmed";
  return active && bookingPhase(booking, now) !== "past";
}

function BookingSection({
  title,
  bookings,
  now,
  onChange,
}: {
  title: string;
  bookings: BookingConfirmationDto[];
  now: number;
  onChange: (updated: BookingConfirmationDto) => void;
}) {
  if (bookings.length === 0) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <h2 style={{ margin: 0, fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text-muted)" }}>
        {title}
      </h2>
      {bookings.map((booking) => (
        <MyBookingCard key={booking.id} booking={booking} now={now} onChange={onChange} />
      ))}
    </section>
  );
}
