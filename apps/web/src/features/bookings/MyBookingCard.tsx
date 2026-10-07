import type { BookingConfirmationDto } from "@app/shared";
import { Card } from "../../components/Card";
import { formatSlotLabel } from "../offers/formatSlotLabel";

interface MyBookingCardProps {
  booking: BookingConfirmationDto;
}

const statusLabels: Record<BookingConfirmationDto["status"], string> = {
  pending: "Ожидает",
  confirmed: "Подтверждена",
  arrived: "Гость пришёл",
  no_show: "Гость не пришёл",
  cancelled: "Отменена",
};

const statusColors: Record<BookingConfirmationDto["status"], string> = {
  pending: "var(--color-text-muted)",
  confirmed: "var(--color-accent-strong)",
  arrived: "var(--color-accent-strong)",
  no_show: "var(--color-danger)",
  cancelled: "var(--color-text-muted)",
};

export function MyBookingCard({ booking }: MyBookingCardProps) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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
        <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: statusColors[booking.status] }}>
          {statusLabels[booking.status]}
        </span>
      </div>
    </Card>
  );
}
