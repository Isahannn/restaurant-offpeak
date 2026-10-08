import { useState } from "react";
import type { OfferFeedItemDto } from "@app/shared";

interface FeaturedOfferCardProps {
  offer: OfferFeedItemDto;
  onOpen: (restaurantId: string) => void;
}

/** Wide photo tile with the discount and name over a soft dark gradient. */
export function FeaturedOfferCard({ offer, onOpen }: FeaturedOfferCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      className="pressable"
      onClick={() => onOpen(offer.restaurantId)}
      style={{
        position: "relative",
        width: 260,
        aspectRatio: "16 / 10",
        borderRadius: "var(--radius-lg)",
        border: "none",
        padding: 0,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "left",
        background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-strong))",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {offer.restaurantImageUrl && !imageFailed && (
        <img
          src={offer.restaurantImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(10, 14, 12, 0.78) 0%, rgba(10, 14, 12, 0.1) 60%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "var(--space-3)",
          right: "var(--space-3)",
          bottom: "var(--space-3)",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>до −{offer.discountPercent}%</span>
        <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {offer.restaurantName} · {offer.title}
        </span>
      </div>
    </button>
  );
}
