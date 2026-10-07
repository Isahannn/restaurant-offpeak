import { useEffect, useState } from "react";
import type { OfferFeedItemDto } from "@app/shared";
import { apiGet } from "../../api/client";
import { FeaturedOffersCarousel } from "./FeaturedOffersCarousel";
import { OfferCard } from "./OfferCard";

const FEATURED_COUNT = 3;

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; offers: OfferFeedItemDto[] };

interface OffersFeedProps {
  onOpenRestaurant: (restaurantId: string) => void;
}

export function OffersFeed({ onOpenRestaurant }: OffersFeedProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiGet<{ offers: OfferFeedItemDto[] }>("/offers")
      .then((data) => {
        if (!cancelled) setState({ status: "ready", offers: data.offers });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p style={{ color: "var(--color-text-muted)" }}>Загружаем предложения…</p>;
  }

  if (state.status === "error") {
    return (
      <p style={{ color: "var(--color-danger)" }}>
        Не удалось загрузить предложения. Попробуйте позже.
      </p>
    );
  }

  if (state.offers.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)" }}>
        Пока нет активных предложений. Загляните позже.
      </p>
    );
  }

  const featured = [...state.offers]
    .filter((o) => o.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, FEATURED_COUNT);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <FeaturedOffersCarousel offers={featured} onOpenRestaurant={onOpenRestaurant} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {state.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onOpenRestaurant={onOpenRestaurant} />
        ))}
      </div>
    </div>
  );
}
