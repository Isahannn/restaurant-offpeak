import { useState } from "react";
import type { BookingConfirmationDto } from "@app/shared";
import { ApiError, apiPost } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { formatSlotLabel } from "../offers/formatSlotLabel";
import type { Phase } from "./bookingPhase";
import { bookingPhase } from "./bookingPhase";

interface MyBookingCardProps {
  booking: BookingConfirmationDto;
  /** Current time from the page's shared clock, so the card updates as time passes. */
  now: number;
  onChange: (updated: BookingConfirmationDto) => void;
}

const cancelErrors: Record<string, string> = {
  slot_started: "Время брони уже наступило — отменить нельзя",
  not_cancellable: "Эту бронь уже нельзя отменить",
};

function statusView(booking: BookingConfirmationDto, phase: Phase): { label: string; color: string } {
  switch (booking.status) {
    case "cancelled":
      return { label: "Отменена", color: "var(--color-text-muted)" };
    case "arrived":
      return { label: "Визит состоялся", color: "var(--color-accent-strong)" };
    case "no_show":
      return { label: "Вы не пришли", color: "var(--color-danger)" };
    default:
      if (phase === "upcoming") return { label: "Подтверждена", color: "var(--color-accent-strong)" };
      if (phase === "in_progress") return { label: "Идёт сейчас", color: "var(--color-accent-strong)" };
      return { label: "Время брони прошло", color: "var(--color-text-muted)" };
  }
}

export function MyBookingCard({ booking, now, onChange }: MyBookingCardProps) {
  const phase = bookingPhase(booking, now);
  const status = statusView(booking, phase);
  const isActive = booking.status === "pending" || booking.status === "confirmed";
  const canCancel = isActive && phase === "upcoming";
  const isFinished = !isActive || phase === "past";

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", opacity: isFinished ? 0.7 : 1 }}>
      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
        {booking.restaurantName}
      </span>
      <h3 style={{ margin: 0, fontSize: "var(--font-size-md)", fontWeight: 600 }}>
        {booking.offerTitle}
      </h3>
      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
        {formatSlotLabel(booking.slotDate)} · {booking.slotStartTime}–{booking.slotEndTime} ·
        Гостей: {booking.partySize}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--space-1)",
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "var(--font-size-lg)",
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {booking.code}
        </span>
        <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: status.color }}>{status.label}</span>
      </div>
      {canCancel && <CancelRow booking={booking} onCancelled={onChange} />}
    </Card>
  );
}

function CancelRow({
  booking,
  onCancelled,
}: {
  booking: BookingConfirmationDto;
  onCancelled: (updated: BookingConfirmationDto) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      onCancelled(await apiPost<BookingConfirmationDto>(`/bookings/${booking.id}/cancel`, {}));
    } catch (err) {
      const reason = err instanceof ApiError ? err.reason : undefined;
      setError((reason && cancelErrors[reason]) ?? "Не удалось отменить, попробуйте ещё раз");
      setConfirming(false);
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        // Fixed height so switching between link, confirmation and error never shifts the card.
        minHeight: 44,
        marginTop: "var(--space-1)",
        paddingTop: "var(--space-2)",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-2)",
      }}
    >
      {confirming ? (
        <>
          <span style={{ fontSize: "var(--font-size-sm)" }}>Отменить бронь?</span>
          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => setConfirming(false)}
              style={{ height: 36, fontSize: "var(--font-size-sm)" }}
            >
              Нет
            </Button>
            <Button
              disabled={submitting}
              onClick={cancel}
              style={{ height: 36, fontSize: "var(--font-size-sm)", background: "var(--color-danger)" }}
            >
              Да, отменить
            </Button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            Отменить бронь
          </button>
          {error && (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-danger)", textAlign: "right" }}>{error}</span>
          )}
        </>
      )}
    </div>
  );
}
