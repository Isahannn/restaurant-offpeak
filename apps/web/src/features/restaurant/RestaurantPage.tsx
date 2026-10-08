import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import {
  hideBackButton,
  mountBackButton,
  offBackButtonClick,
  onBackButtonClick,
  showBackButton,
} from "@telegram-apps/sdk-react";
import type { OfferFeedItemDto } from "@app/shared";
import { useApi } from "../../api/useApi";
import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { useNow } from "../../hooks/useNow";
import { OfferCard } from "../offers/OfferCard";
import { slotsForFilter } from "../offers/slotTime";

interface RestaurantDetailResponse {
  restaurant: {
    id: string;
    name: string;
    imageUrl?: string;
    description?: string;
  };
  offers: OfferFeedItemDto[];
}

interface RestaurantPageProps {
  restaurantId: string;
  onBack: () => void;
}

export function RestaurantPage({ restaurantId, onBack }: RestaurantPageProps) {
  const state = useApi<RestaurantDetailResponse>(`/restaurants/${restaurantId}`);
  const now = useNow();

  // Telegram's native back button, when available.
  useEffect(() => {
    try {
      mountBackButton();
      showBackButton();
      onBackButtonClick(onBack);
    } catch {
      // Not running inside Telegram — the on-screen back button covers it.
    }
    return () => {
      try {
        offBackButtonClick(onBack);
        hideBackButton();
      } catch {
        // noop
      }
    };
  }, [onBack]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <Hero
        name={state.status === "ready" ? state.data.restaurant.name : undefined}
        imageUrl={state.status === "ready" ? state.data.restaurant.imageUrl : undefined}
        onBack={onBack}
      />

      <div style={{ padding: "var(--space-5) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {state.status === "loading" && (
          <>
            <Skeleton height={16} width="85%" />
            <Skeleton height={16} width="60%" />
            <Skeleton height={undefined} radius="var(--radius-xl)" style={{ aspectRatio: "4 / 3" }} />
          </>
        )}

        {state.status === "error" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Не удалось загрузить ресторан</p>
            <Button variant="secondary" onClick={state.reload}>
              Повторить
            </Button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            {state.data.restaurant.description && (
              <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.55 }}>{state.data.restaurant.description}</p>
            )}

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <h2 style={{ margin: 0, fontSize: "var(--font-size-md)", fontWeight: 600 }}>Предложения</h2>
              {state.data.offers.length === 0 ? (
                <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Сейчас у ресторана нет активных предложений.</p>
              ) : (
                state.data.offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} slots={slotsForFilter(offer.slots, "all", now)} now={now} />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Hero({ name, imageUrl, onBack }: { name?: string; imageUrl?: string; onBack: () => void }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16 / 11",
        background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-strong))",
        overflow: "hidden",
      }}
    >
      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(10, 14, 12, 0.75) 0%, rgba(10, 14, 12, 0.05) 55%, rgba(10, 14, 12, 0.25) 100%)",
        }}
      />

      <button
        type="button"
        aria-label="Назад"
        onClick={onBack}
        className="pressable"
        style={{
          position: "absolute",
          top: "var(--space-3)",
          left: "var(--space-3)",
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255, 255, 255, 0.9)",
          color: "#1c1c1e",
          boxShadow: "var(--shadow-sm)",
          cursor: "pointer",
        }}
      >
        <ArrowLeftIcon style={{ width: 20, height: 20 }} />
      </button>

      <h1
        style={{
          position: "absolute",
          left: "var(--space-4)",
          right: "var(--space-4)",
          bottom: "var(--space-4)",
          margin: 0,
          minHeight: 32,
          color: "#ffffff",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {name}
      </h1>
    </div>
  );
}
