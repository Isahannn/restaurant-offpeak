import { useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import type { OfferFeedItemDto, SlotDto } from "@app/shared";
import { Chip } from "../../components/Chip";
import { haptic } from "../../theme/haptics";
import { BookingSheet } from "./BookingSheet";
import { dayLabel, seatsLeft } from "./slotTime";

const QUICK_SLOTS = 6;

interface OfferCardProps {
  offer: OfferFeedItemDto;
  /** Bookable slots to surface on the card, already filtered by the feed. */
  slots: SlotDto[];
  now: number;
  /** Omit on the restaurant's own page, where the name is already the header. */
  onOpenRestaurant?: (restaurantId: string) => void;
}

export function OfferCard({ offer, slots, now, onOpenRestaurant }: OfferCardProps) {
  const [sheet, setSheet] = useState<{ open: boolean; slotId?: string }>({ open: false });
  const nearest = slots[0];
  const quick = slots.slice(0, QUICK_SLOTS);

  const openSheet = (slotId?: string) => {
    haptic.tap();
    setSheet({ open: true, slotId });
  };
  const openRestaurant = onOpenRestaurant ? () => onOpenRestaurant(offer.restaurantId) : undefined;

  return (
    <article
      className="fade-up"
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}
    >
      {/* On the restaurant's own page the hero already shows the photo. */}
      {onOpenRestaurant && (
        <Photo
          src={offer.restaurantImageUrl}
          discountPercent={offer.discountPercent}
          onClick={openRestaurant}
          label={offer.restaurantName}
        />
      )}

      <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div
          onClick={openRestaurant}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)", cursor: openRestaurant ? "pointer" : "default" }}
        >
          <div style={{ minWidth: 0 }}>
            {onOpenRestaurant && (
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{offer.restaurantName}</div>
            )}
            <h3 style={{ margin: "2px 0 0", fontSize: "var(--font-size-md)", fontWeight: 600, lineHeight: 1.3 }}>{offer.title}</h3>
          </div>
          {!onOpenRestaurant && offer.discountPercent > 0 && <DiscountPill percent={offer.discountPercent} />}
          {openRestaurant && <ChevronRightIcon style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, color: "var(--color-text-muted)" }} />}
        </div>

        <div style={{ fontSize: "var(--font-size-sm)", color: nearest ? "var(--color-text)" : "var(--color-text-muted)" }}>
          {nearest ? (
            <>
              Ближайшее: <b style={{ fontWeight: 600 }}>{dayLabel(nearest.date, now)}, {nearest.startTime}</b>
              <span style={{ color: "var(--color-text-muted)" }}> · мест {seatsLeft(nearest)}</span>
            </>
          ) : (
            "В это время свободных мест нет"
          )}
        </div>

        {quick.length > 0 && (
          <div className="scroll-row" style={{ paddingBottom: 2 }}>
            {quick.map((slot) => (
              <Chip key={slot.id} hint={slot.discountPercent > 0 ? `−${slot.discountPercent}%` : "\u00a0"} onClick={() => openSheet(slot.id)}>
                {slot.date === nearest?.date ? slot.startTime : `${dayLabel(slot.date, now)} ${slot.startTime}`}
              </Chip>
            ))}
            <Chip hint="время" onClick={() => openSheet()}>
              Все
            </Chip>
          </div>
        )}
      </div>

      <BookingSheet offer={offer} open={sheet.open} initialSlotId={sheet.slotId} onClose={() => setSheet({ open: false })} />
    </article>
  );
}

function Photo({
  src,
  discountPercent,
  label,
  onClick,
}: {
  src?: string;
  discountPercent: number;
  label: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        // Reserve the box up front so cards never jump when images arrive.
        aspectRatio: "16 / 9",
        background: "linear-gradient(135deg, var(--color-accent-soft), var(--color-surface-muted))",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {showImage && (
        <img
          src={src}
          alt={label}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {discountPercent > 0 && (
        <span style={{ position: "absolute", left: "var(--space-3)", bottom: "var(--space-3)" }}>
          <DiscountPill percent={discountPercent} />
        </span>
      )}
    </div>
  );
}

function DiscountPill({ percent }: { percent: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        flexShrink: 0,
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-pill)",
        background: "var(--color-accent)",
        color: "var(--color-accent-contrast)",
        fontSize: "var(--font-size-sm)",
        fontWeight: 600,
        whiteSpace: "nowrap",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      до −{percent}%
    </span>
  );
}
