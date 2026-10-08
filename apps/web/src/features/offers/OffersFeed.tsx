import { useMemo, useState } from "react";
import type { OfferFeedItemDto } from "@app/shared";
import { useApi } from "../../api/useApi";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { Skeleton } from "../../components/Skeleton";
import { useNow } from "../../hooks/useNow";
import { haptic } from "../../theme/haptics";
import { FeaturedOffersCarousel } from "./FeaturedOffersCarousel";
import { OfferCard } from "./OfferCard";
import { TIME_FILTERS, slotStartMs, slotsForFilter, type TimeFilter } from "./slotTime";

const FEATURED_COUNT = 4;

const EMPTY_TEXT: Record<TimeFilter, string> = {
  now: "В ближайшие два часа свободных столиков нет",
  today: "На сегодня свободных столиков не осталось",
  tomorrow: "На завтра пока ничего нет",
  all: "Пока нет активных предложений — загляните позже",
};

interface OffersFeedProps {
  onOpenRestaurant: (restaurantId: string) => void;
}

export function OffersFeed({ onOpenRestaurant }: OffersFeedProps) {
  const state = useApi<{ offers: OfferFeedItemDto[] }>("/offers");
  const now = useNow();
  const [filter, setFilter] = useState<TimeFilter>("all");

  const visible = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.data.offers
      .map((offer) => ({ offer, slots: slotsForFilter(offer.slots, filter, now) }))
      .filter(({ slots }) => slots.length > 0)
      // Soonest available table first: that's what someone hungry wants.
      .sort((a, b) => slotStartMs(a.slots[0]) - slotStartMs(b.slots[0]));
  }, [state, filter, now]);

  const featured = useMemo(
    () =>
      [...visible]
        .filter(({ offer }) => offer.discountPercent > 0)
        .sort((a, b) => b.offer.discountPercent - a.offer.discountPercent)
        .slice(0, FEATURED_COUNT)
        .map(({ offer }) => offer),
    [visible],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>Свободные столики</h1>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)" }}>Скидки в тихие часы ресторанов</p>
        </div>
        <div className="scroll-row" role="tablist" aria-label="Когда">
          {TIME_FILTERS.map(({ id, label }) => (
            <Chip
              key={id}
              role="tab"
              aria-selected={filter === id}
              selected={filter === id}
              onClick={() => {
                if (filter !== id) haptic.select();
                setFilter(id);
              }}
            >
              {label}
            </Chip>
          ))}
        </div>
      </header>

      {state.status === "loading" && <FeedSkeleton />}

      {state.status === "error" && (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Не удалось загрузить предложения</p>
          <Button variant="secondary" onClick={state.reload}>
            Повторить
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {filter === "all" && <FeaturedOffersCarousel offers={featured} onOpenRestaurant={onOpenRestaurant} />}

          {visible.length === 0 ? (
            <p style={{ margin: "var(--space-5) 0", textAlign: "center", color: "var(--color-text-muted)" }}>{EMPTY_TEXT[filter]}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {visible.map(({ offer, slots }) => (
                <OfferCard key={offer.id} offer={offer} slots={slots} now={now} onOpenRestaurant={onOpenRestaurant} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ borderRadius: "var(--radius-xl)", overflow: "hidden", background: "var(--color-surface)", boxShadow: "var(--shadow-sm)" }}>
          <Skeleton height={undefined} radius={0} style={{ aspectRatio: "16 / 9" }} />
          <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="70%" height={18} />
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} width={64} height={52} radius="var(--radius-md)" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
