import type { OfferFeedItemDto } from "@app/shared";
import { FeaturedOfferCard } from "./FeaturedOfferCard";

interface FeaturedOffersCarouselProps {
  offers: OfferFeedItemDto[];
  onOpenRestaurant: (restaurantId: string) => void;
}

export function FeaturedOffersCarousel({ offers, onOpenRestaurant }: FeaturedOffersCarouselProps) {
  if (offers.length === 0) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <h2 style={{ margin: 0, fontSize: "var(--font-size-md)", fontWeight: 600 }}>
        Лучшие предложения
      </h2>
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          overflowX: "auto",
          paddingBottom: "var(--space-2)",
        }}
      >
        {offers.map((offer) => (
          <FeaturedOfferCard key={offer.id} offer={offer} onOpen={onOpenRestaurant} />
        ))}
      </div>
    </section>
  );
}
