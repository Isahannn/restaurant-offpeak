import { useEffect, useState } from "react";
import {
  hideBackButton,
  mountBackButton,
  offBackButtonClick,
  onBackButtonClick,
  showBackButton,
} from "@telegram-apps/sdk-react";
import type { OfferFeedItemDto } from "@app/shared";
import { apiGet } from "../../api/client";
import { OfferCard } from "../offers/OfferCard";

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

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: RestaurantDetailResponse };

export function RestaurantPage({ restaurantId, onBack }: RestaurantPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    try {
      mountBackButton();
      showBackButton();
      onBackButtonClick(onBack);
    } catch {
      // Not running inside Telegram — no native back button available.
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

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    apiGet<RestaurantDetailResponse>(`/restaurants/${restaurantId}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ← Назад
      </button>

      {state.status === "loading" && (
        <p style={{ color: "var(--color-text-muted)" }}>Загружаем ресторан…</p>
      )}

      {state.status === "error" && (
        <p style={{ color: "var(--color-danger)" }}>
          Не удалось загрузить ресторан. Попробуйте позже.
        </p>
      )}

      {state.status === "ready" && (
        <>
          {state.data.restaurant.imageUrl && (
            <img
              src={state.data.restaurant.imageUrl}
              alt=""
              style={{
                width: "100%",
                height: 200,
                objectFit: "cover",
                borderRadius: "var(--radius-lg)",
                display: "block",
              }}
            />
          )}

          <div>
            <h1 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
              {state.data.restaurant.name}
            </h1>
            {state.data.restaurant.description && (
              <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-muted)" }}>
                {state.data.restaurant.description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {state.data.offers.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                У этого ресторана пока нет активных предложений.
              </p>
            ) : (
              state.data.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
