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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {state.bookings.map((booking) => (
            <MyBookingCard
              key={booking.id}
              booking={booking}
              onChange={(updated) =>
                setState((prev) =>
                  prev.status === "ready"
                    ? { status: "ready", bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)) }
                    : prev,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
