import { useEffect, useState } from "react";
import { PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
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
  // null: the list; otherwise the form, empty for a new offer or filled for an edit.
  const [form, setForm] = useState<{ offer?: OfferAdminDto } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  if (form) {
    return (
      <OfferForm
        initial={form.offer}
        onCancel={() => setForm(null)}
        onSaved={(saved, note) => {
          setState((prev) => {
            if (prev.status !== "ready") return prev;
            const exists = prev.offers.some((o) => o.id === saved.id);
            return {
              status: "ready",
              offers: exists ? prev.offers.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...prev.offers],
            };
          });
          setNotice(note ?? null);
          setForm(null);
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
          <Button
            onClick={() => {
              setNotice(null);
              setForm({});
            }}
            style={{ height: 36, fontSize: "var(--font-size-sm)", flexShrink: 0 }}
          >
            <PlusIcon style={{ width: 16, height: 16 }} />
            Новое
          </Button>
        }
      />

      {notice && (
        <p role="status" className="fade-up" style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-accent-strong)" }}>
          {notice}
        </p>
      )}

      {state.status === "loading" && <StatusMessage>Загружаем предложения…</StatusMessage>}
      {state.status === "error" && <StatusMessage>Не удалось загрузить предложения</StatusMessage>}
      {state.status === "ready" && state.offers.length === 0 && (
        <StatusMessage>Пока нет предложений — создайте первое</StatusMessage>
      )}

      {state.status === "ready" && state.offers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {state.offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              disabled={togglingId === offer.id}
              onToggle={() => toggle(offer)}
              onEdit={() => {
                setNotice(null);
                setForm({ offer });
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function OfferRow({
  offer,
  disabled,
  onToggle,
  onEdit,
}: {
  offer: OfferAdminDto;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
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
      <button
        type="button"
        onClick={onEdit}
        className="pressable"
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          marginTop: "var(--space-1)",
          padding: 0,
          border: "none",
          background: "none",
          color: "var(--color-accent-strong)",
          fontSize: "var(--font-size-sm)",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <PencilSquareIcon style={{ width: 16, height: 16 }} />
        Изменить
      </button>
    </Card>
  );
}
