import { useState } from "react";
import { ClockIcon, TagIcon, UsersIcon } from "@heroicons/react/24/outline";
import type { BookingConfirmationDto, OfferFeedItemDto } from "@app/shared";
import { apiPost, ApiError } from "../../api/client";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { BookingConfirmation } from "./BookingConfirmation";
import { formatDaysOfWeek } from "./formatDaysOfWeek";
import { PartySizeStepper } from "./PartySizeStepper";
import { SlotPicker } from "./SlotPicker";

interface OfferCardProps {
  offer: OfferFeedItemDto;
  onOpenRestaurant?: (restaurantId: string) => void;
}

function firstAvailableSlotId(offer: OfferFeedItemDto): string | null {
  const slot = offer.slots.find((s) => s.seatsTotal - s.seatsBooked > 0);
  return slot?.id ?? null;
}

const errorMessages: Record<string, string> = {
  sold_out: "Места на эту дату уже разобрали. Выберите другую.",
  slot_not_found: "Эта дата больше не доступна. Выберите другую.",
  slot_started: "Это время уже наступило. Выберите более позднее.",
};

const iconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  color: "var(--color-text-muted)",
  flexShrink: 0,
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-1)",
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-sm)",
};

export function OfferCard({ offer, onOpenRestaurant }: OfferCardProps) {
  const nearestSlot = offer.slots[0];
  const seatsAvailable = nearestSlot ? nearestSlot.seatsTotal - nearestSlot.seatsBooked : 0;
  const hasBookableSlots = offer.slots.some((s) => s.seatsTotal - s.seatsBooked > 0);

  const [expanded, setExpanded] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingConfirmationDto | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const selectedSlot = offer.slots.find((s) => s.id === selectedSlotId) ?? null;
  const maxPartySize = selectedSlot ? Math.max(1, selectedSlot.seatsTotal - selectedSlot.seatsBooked) : 1;

  function handleExpand() {
    setExpanded(true);
    setError(null);
    const firstId = firstAvailableSlotId(offer);
    setSelectedSlotId(firstId);
    setPartySize(1);
  }

  function handleSelectSlot(slotId: string) {
    setSelectedSlotId(slotId);
    setPartySize(1);
    setError(null);
  }

  async function handleConfirm() {
    if (!selectedSlotId) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await apiPost<BookingConfirmationDto>("/bookings", {
        slotId: selectedSlotId,
        partySize,
      });
      setConfirmedBooking(booking);
      setExpanded(false);
    } catch (err) {
      const reason = err instanceof ApiError ? err.reason : undefined;
      setError((reason && errorMessages[reason]) ?? "Не удалось забронировать. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  const restaurantClickable = Boolean(onOpenRestaurant);

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {offer.restaurantImageUrl && !imageFailed && (
        <img
          src={offer.restaurantImageUrl}
          alt=""
          onError={() => setImageFailed(true)}
          onClick={restaurantClickable ? () => onOpenRestaurant!(offer.restaurantId) : undefined}
          style={{
            width: "100%",
            height: 160,
            objectFit: "cover",
            display: "block",
            cursor: restaurantClickable ? "pointer" : "default",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          padding: "var(--space-4)",
        }}
      >
      <span
        onClick={restaurantClickable ? () => onOpenRestaurant!(offer.restaurantId) : undefined}
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-muted)",
          cursor: restaurantClickable ? "pointer" : "default",
          textDecoration: restaurantClickable ? "underline" : "none",
          alignSelf: "flex-start",
        }}
      >
        {offer.restaurantName}
      </span>

      <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
        {offer.title}
      </h3>

      <Badge style={{ alignSelf: "flex-start" }}>
        <TagIcon style={{ width: 14, height: 14 }} />
        {offer.discountPercent > 0 ? `Скидка до ${offer.discountPercent}%` : "Бронь без скидки"}
      </Badge>

      <div style={metaRowStyle}>
        <ClockIcon style={iconStyle} />
        <span>
          {formatDaysOfWeek(offer.daysOfWeek)} · {offer.startTime}–{offer.endTime}
        </span>
      </div>

      {nearestSlot ? (
        <div style={metaRowStyle}>
          <UsersIcon style={iconStyle} />
          <span>
            {seatsAvailable > 0
              ? `Свободно мест: ${seatsAvailable} из ${nearestSlot.seatsTotal}`
              : "Мест нет на ближайшую дату"}
          </span>
        </div>
      ) : (
        <div style={metaRowStyle}>
          <span>Нет доступных дат</span>
        </div>
      )}

      {offer.exceptions.length > 0 && (
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          Не участвует: {offer.exceptions.join(", ")}
        </span>
      )}

      {hasBookableSlots && !expanded && (
        <Button onClick={handleExpand} style={{ marginTop: "var(--space-2)" }}>
          Забронировать
        </Button>
      )}

      {expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            marginTop: "var(--space-2)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <SlotPicker
            slots={offer.slots}
            selectedSlotId={selectedSlotId}
            onSelect={handleSelectSlot}
          />

          {selectedSlot && (
            <PartySizeStepper value={partySize} max={maxPartySize} onChange={setPartySize} />
          )}

          {error && (
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-danger)" }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button
              onClick={handleConfirm}
              disabled={!selectedSlot || submitting}
              style={{ flex: 1 }}
            >
              {submitting ? "Бронируем…" : "Подтвердить бронь"}
            </Button>
            <Button variant="secondary" onClick={() => setExpanded(false)}>
              Отмена
            </Button>
          </div>
        </div>
      )}
      </div>

      {confirmedBooking && (
        <BookingConfirmation booking={confirmedBooking} onClose={() => setConfirmedBooking(null)} />
      )}
    </Card>
  );
}
