import { useState } from "react";
import type { OfferFeedItemDto } from "@app/shared";
import { Badge } from "../../components/Badge";

interface FeaturedOfferCardProps {
  offer: OfferFeedItemDto;
  onOpen: (restaurantId: string) => void;
}

export function FeaturedOfferCard({ offer, onOpen }: FeaturedOfferCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(offer.restaurantId)}
      style={{
        flex: "0 0 auto",
        width: 180,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {offer.restaurantImageUrl && !imageFailed ? (
        <img
          src={offer.restaurantImageUrl}
          alt=""
          onError={() => setImageFailed(true)}
          style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ width: "100%", height: 100, background: "var(--color-surface-muted)" }} />
      )}

      <div style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {offer.restaurantName}
        </span>
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {offer.title}
        </span>
        <Badge style={{ alignSelf: "flex-start" }}>
          {offer.discountPercent > 0 ? `−${offer.discountPercent}%` : "Без скидки"}
        </Badge>
      </div>
    </button>
  );
}
