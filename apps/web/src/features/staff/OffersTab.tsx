import { useEffect, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import type { OfferAdminDto } from "@app/shared";
import { apiGet, apiPatch } from "../../api/client";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Switch } from "../../components/Switch";
import { formatDaysOfWeek } from "../offers/formatDaysOfWeek";
import { OfferForm } from "./OfferForm";
import { SectionHeader, StatusMessage } from "./ui";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; offers: OfferAdminDto[] };

export function OffersTab() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ offers: OfferAdminDto[] }>("/restaurant/offers")
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

  const toggle = async (offer: OfferAdminDto) => {
    setTogglingId(offer.id);
    try {
      const updated = await apiPatch<OfferAdminDto>(`/restaurant/offers/${offer.id}`, { active: !offer.active });
      setState((prev) =>
        prev.status === "ready"
          ? { status: "ready", offers: prev.offers.map((o) => (o.id === updated.id ? updated : o)) }
          : prev,
      );
    } catch {
      // Switch stays in its previous position; nothing else to roll back.
    } finally {
      setTogglingId(null);
    }
  };

  if (creating) {
    return (
      <OfferForm
        onCancel={() => setCreating(false)}
        onCreated={(offer) => {
          setState((prev) => (prev.status === "ready" ? { status: "ready", offers: [offer, ...prev.offers] } : prev));
          setCreating(false);
        }}
      />
    );
  }

  return (
    <>
      <SectionHeader
        title="Предложения"
        subtitle="Скидки на слабые часы"
        action={
          <Button onClick={() => setCreating(true)} style={{ height: 36, fontSize: "var(--font-size-sm)", flexShrink: 0 }}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            Новое
          </Button>
        }
      />

      {state.status === "loading" && <StatusMessage>Загружаем предложения…</StatusMessage>}
      {state.status === "error" && <StatusMessage>Не удалось загрузить предложения</StatusMessage>}
      {state.status === "ready" && state.offers.length === 0 && (
        <StatusMessage>Пока нет предложений — создайте первое</StatusMessage>
      )}

      {state.status === "ready" && state.offers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {state.offers.map((offer) => (
            <OfferRow key={offer.id} offer={offer} disabled={togglingId === offer.id} onToggle={() => toggle(offer)} />
          ))}
        </div>
      )}
    </>
  );
}

function OfferRow({ offer, disabled, onToggle }: { offer: OfferAdminDto; disabled: boolean; onToggle: () => void }) {
  const discountHours =
    offer.discountWindows.length > 0
      ? offer.discountWindows.map((w) => `${w.startTime}–${w.endTime}`).join(", ")
      : `${offer.startTime}–${offer.endTime}`;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", opacity: offer.active ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {offer.title}
          </span>
          <Badge>−{offer.discountPercent}%</Badge>
        </div>
        <Switch checked={offer.active} disabled={disabled} onChange={onToggle} label={offer.active ? "Выключить" : "Включить"} />
      </div>
      <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
        {formatDaysOfWeek(offer.daysOfWeek)} · скидка {discountHours}
      </div>
      <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
        {offer.seatsPerSlot} мест на слот
        {offer.exceptions.length > 0 && ` · кроме: ${offer.exceptions.join(", ")}`}
      </div>
    </Card>
  );
}
