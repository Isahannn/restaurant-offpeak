import { QRCodeSVG } from "qrcode.react";
import type { BookingConfirmationDto } from "@app/shared";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { formatSlotLabel } from "./formatSlotLabel";

interface BookingConfirmationProps {
  booking: BookingConfirmationDto;
  onClose: () => void;
}

export function BookingConfirmation({ booking, onClose }: BookingConfirmationProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 360,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          {booking.restaurantName}
        </span>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
          Бронь подтверждена
        </h2>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          {booking.offerTitle} · {formatSlotLabel(booking.slotDate)} · {booking.slotStartTime}–
          {booking.slotEndTime}
        </p>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Гостей: {booking.partySize}</p>

        <div style={{ padding: "var(--space-3)", background: "#ffffff", borderRadius: "var(--radius-md)" }}>
          <QRCodeSVG value={booking.code} size={180} />
        </div>

        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
            fontFamily: "monospace",
          }}
        >
          {booking.code}
        </span>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          Покажите код или QR на входе
        </p>

        <Button onClick={onClose} style={{ width: "100%", marginTop: "var(--space-2)" }}>
          Готово
        </Button>
      </Card>
    </div>
  );
}
