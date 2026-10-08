import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { BookingConfirmationDto, OfferFeedItemDto } from "@app/shared";
import { ApiError, apiPost } from "../../api/client";
import { invalidate } from "../../api/useApi";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { haptic } from "../../theme/haptics";
import { PartySizeStepper } from "./PartySizeStepper";
import { dayLabel, groupByDate, isBookable, seatsLeft } from "./slotTime";

const ERRORS: Record<string, string> = {
  sold_out: "Места на это время уже разобрали — выберите другое",
  slot_not_found: "Это время больше недоступно — выберите другое",
  slot_started: "Это время уже наступило — выберите более позднее",
};

interface BookingSheetProps {
  offer: OfferFeedItemDto;
  open: boolean;
  /** Slot tapped on the card; the sheet opens with it selected. */
  initialSlotId?: string;
  onClose: () => void;
}

export function BookingSheet({ offer, open, initialSlotId, onClose }: BookingSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} label={`Бронь: ${offer.restaurantName}`}>
      {/* Remount per opening so every visit starts from a clean form. */}
      {open && <BookingForm offer={offer} initialSlotId={initialSlotId} onClose={onClose} />}
    </BottomSheet>
  );
}

function BookingForm({ offer, initialSlotId, onClose }: Omit<BookingSheetProps, "open">) {
  const [now] = useState(() => Date.now());
  const days = useMemo(
    () => groupByDate(offer.slots.filter((slot) => isBookable(slot, now))),
    [offer.slots, now],
  );

  const initialSlot = days.flatMap((d) => d.slots).find((s) => s.id === initialSlotId);
  const [date, setDate] = useState(initialSlot?.date ?? days[0]?.date ?? "");
  const [slotId, setSlotId] = useState<string | null>(initialSlot?.id ?? days[0]?.slots[0]?.id ?? null);
  const [partySize, setPartySize] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<BookingConfirmationDto | null>(null);

  const daySlots = days.find((d) => d.date === date)?.slots ?? [];
  const slot = daySlots.find((s) => s.id === slotId) ?? null;
  const maxParty = slot ? Math.min(seatsLeft(slot), 12) : 1;
  const party = Math.min(partySize, maxParty);

  if (confirmed) {
    return <Confirmation booking={confirmed} onDone={onClose} />;
  }

  const pickDate = (next: string) => {
    haptic.select();
    setDate(next);
    setSlotId(days.find((d) => d.date === next)?.slots[0]?.id ?? null);
    setError(null);
  };

  const submit = async () => {
    if (!slot || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await apiPost<BookingConfirmationDto>("/bookings", { slotId: slot.id, partySize: party });
      haptic.success();
      invalidate("/offers", "/restaurants", "/bookings/me");
      setConfirmed(booking);
    } catch (err) {
      haptic.error();
      const reason = err instanceof ApiError ? err.reason : undefined;
      setError((reason && ERRORS[reason]) ?? "Не удалось забронировать, попробуйте ещё раз");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{offer.restaurantName}</div>
        <h2 style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-lg)", fontWeight: 600 }}>{offer.title}</h2>
      </header>

      {days.length === 0 ? (
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Свободных мест пока нет — загляните позже.</p>
      ) : (
        <>
          <Section title="День">
            <div className="scroll-row">
              {days.map((d) => (
                <Chip key={d.date} selected={d.date === date} onClick={() => pickDate(d.date)}>
                  {dayLabel(d.date, now)}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Время">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: "var(--space-2)" }}>
              {daySlots.map((s) => (
                <Chip
                  key={s.id}
                  selected={s.id === slotId}
                  hint={s.discountPercent > 0 ? `−${s.discountPercent}%` : "\u00a0"}
                  onClick={() => {
                    haptic.select();
                    setSlotId(s.id);
                    setError(null);
                  }}
                >
                  {s.startTime}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Гости">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <PartySizeStepper value={party} max={maxParty} onChange={setPartySize} label="" />
              {slot && (
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                  свободно {seatsLeft(slot)}
                </span>
              )}
            </div>
          </Section>

          {offer.exceptions.length > 0 && (
            <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              Скидка не действует на: {offer.exceptions.join(", ")}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <p style={{ margin: 0, minHeight: 20, fontSize: "var(--font-size-sm)", color: "var(--color-danger)" }}>{error}</p>
            <Button onClick={submit} disabled={!slot || submitting} style={{ width: "100%", height: 52 }}>
              {submitting
                ? "Бронируем…"
                : slot
                  ? `Забронировать · ${dayLabel(slot.date, now)}, ${slot.startTime}`
                  : "Выберите время"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <h3 style={{ margin: 0, fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text-muted)" }}>{title}</h3>
      {children}
    </section>
  );
}

function Confirmation({ booking, onDone }: { booking: BookingConfirmationDto; onDone: () => void }) {
  const [now] = useState(() => Date.now());
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", textAlign: "center" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>Столик ваш</h2>
        <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)" }}>
          {booking.restaurantName} · {dayLabel(booking.slotDate, now)}, {booking.slotStartTime} · гостей: {booking.partySize}
        </p>
      </div>

      <div style={{ padding: "var(--space-3)", background: "#ffffff", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
        <QRCodeSVG value={booking.code} size={168} />
      </div>

      <div>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "0.12em", fontVariantNumeric: "tabular-nums" }}>{booking.code}</div>
        <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Покажите код или QR при входе. Бронь — в «Моих бронях».
        </p>
      </div>

      <Button onClick={onDone} style={{ width: "100%", height: 52 }}>
        Готово
      </Button>
    </div>
  );
}
