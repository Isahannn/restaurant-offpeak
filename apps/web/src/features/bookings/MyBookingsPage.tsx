import { useEffect, useState } from "react";
import {
  hideBackButton,
  mountBackButton,
  offBackButtonClick,
  onBackButtonClick,
  showBackButton,
} from "@telegram-apps/sdk-react";
import type { BookingConfirmationDto } from "@app/shared";
import { apiGet } from "../../api/client";
import { bookingPhase } from "./bookingPhase";
import { MyBookingCard } from "./MyBookingCard";

interface MyBookingsPageProps {
  onBack: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; bookings: BookingConfirmationDto[] };

export function MyBookingsPage({ onBack }: MyBookingsPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate every 30s so cancel links and statuses change while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      mountBackButton();
      showBackButton();
      onBackButtonClick(onBack);
    } catch {
      // Not running inside Telegram — no native back button available.
    }
    return () => {
      try {
        offBackButtonClick(onBack);
        hideBackButton();
      } catch {
        // noop
      }
    };
  }, [onBack]);

  const replaceBooking = (updated: BookingConfirmationDto) =>
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)) }
        : prev,
    );

  useEffect(() => {
    let cancelled = false;

    apiGet<{ bookings: BookingConfirmationDto[] }>("/bookings/me")
      .then((data) => {
        if (!cancelled) setState({ status: "ready", bookings: data.bookings });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ← Назад
      </button>

      <h1 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>Мои брони</h1>

      {state.status === "loading" && (
        <p style={{ color: "var(--color-text-muted)" }}>Загружаем брони…</p>
      )}

      {state.status === "error" && (
        <p style={{ color: "var(--color-danger)" }}>
          Не удалось загрузить брони. Попробуйте позже.
        </p>
      )}

      {state.status === "ready" && state.bookings.length === 0 && (
        <p style={{ color: "var(--color-text-muted)" }}>У вас пока нет броней.</p>
      )}

      {state.status === "ready" && state.bookings.length > 0 && (
        <>
          <BookingSection
            title="Предстоящие"
            bookings={state.bookings
              .filter((b) => isUpcoming(b, now))
              .sort((a, b) => startKey(a).localeCompare(startKey(b)))}
            now={now}
            onChange={replaceBooking}
          />
          <BookingSection
            title="Прошедшие"
            bookings={state.bookings
              .filter((b) => !isUpcoming(b, now))
              .sort((a, b) => startKey(b).localeCompare(startKey(a)))}
            now={now}
            onChange={replaceBooking}
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
