import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { RestaurantSlotDto } from "@app/shared";
import { ApiError, apiGet, apiPatch } from "../../api/client";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Switch } from "../../components/Switch";
import { haptic } from "../../theme/haptics";
import { shiftDate, toLocalDateString } from "./dates";
import { DayNavigator } from "./DayNavigator";
import { inputStyle } from "./inputStyle";
import { SectionHeader, StatusMessage } from "./ui";

const MAX_SEATS = 200;
/** Stepper taps are batched: one request once the taps settle. */
const SAVE_DELAY_MS = 450;

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; slots: RestaurantSlotDto[] };

export function SeatsTab({ refreshKey }: { refreshKey: number }) {
  const [today] = useState(() => toLocalDateString(new Date()));
  const [date, setDate] = useState(today);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  // Bumped after a rejected save so rows drop their draft and show the server's value.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ slots: RestaurantSlotDto[] }>(`/restaurant/slots?date=${date}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", slots: data.slots });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // refreshKey: live booking events change "booked" counts.
  }, [date, refreshKey]);

  const replaceSlot = (updated: RestaurantSlotDto) =>
    setState((prev) =>
      prev.status === "ready" ? { status: "ready", slots: prev.slots.map((s) => (s.id === updated.id ? updated : s)) } : prev,
    );

  const saveSeats = async (slot: RestaurantSlotDto, seatsTotal: number) => {
    try {
      replaceSlot(await apiPatch<RestaurantSlotDto>(`/restaurant/slots/${slot.id}`, { seatsTotal }));
      setMessage(null);
    } catch (err) {
      haptic.error();
      const reason = err instanceof ApiError ? err.reason : undefined;
      setMessage({
        tone: "error",
        text:
          reason === "below_booked"
            ? "Нельзя меньше, чем уже забронировано"
            : reason === "slot_started"
              ? "Этот слот уже начался"
              : "Не удалось сохранить, попробуйте ещё раз",
      });
      setRevision((r) => r + 1);
    }
  };

  const changeDate = (days: number) => {
    setState({ status: "loading" });
    setMessage(null);
    setDate(shiftDate(date, days));
  };

  const slots = state.status === "ready" ? state.slots : [];
  const openSeats = slots.filter((s) => !s.started).reduce((sum, s) => sum + Math.max(0, s.seatsTotal - s.seatsBooked), 0);
  const showOffer = new Set(slots.map((s) => s.offerTitle)).size > 1;

  return (
    <>
      <SectionHeader title="Места" subtitle="Сколько столиков можно забронировать" />

      <DayNavigator
        date={date}
        today={today}
        onShift={changeDate}
        subtitle={state.status === "ready" && slots.length > 0 && `свободно для брони: ${openSeats}`}
      />

      {state.status === "ready" && slots.some((s) => !s.started) && (
        <Button variant="secondary" onClick={() => setRangeOpen(true)} style={{ width: "100%" }}>
          Закрыть или открыть часы…
        </Button>
      )}

      {message && (
        <p
          role="status"
          className="fade-up"
          style={{
            margin: 0,
            fontSize: "var(--font-size-sm)",
            color: message.tone === "error" ? "var(--color-danger)" : "var(--color-accent-strong)",
          }}
        >
          {message.text}
        </p>
      )}

      {state.status === "loading" && <StatusMessage>Загружаем слоты…</StatusMessage>}
      {state.status === "error" && <StatusMessage>Не удалось загрузить слоты</StatusMessage>}
      {state.status === "ready" && slots.length === 0 && <StatusMessage>На этот день слотов нет</StatusMessage>}

      {slots.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {slots.map((slot) => (
            <SlotRow key={`${slot.id}:${slot.seatsTotal}:${revision}`} slot={slot} showOffer={showOffer} onSave={saveSeats} />
          ))}
        </div>
      )}

      <RangeSheet
        open={rangeOpen}
        date={date}
        onClose={() => setRangeOpen(false)}
        onDone={(updated, text) => {
          setState({ status: "ready", slots: updated });
          setMessage({ tone: "success", text });
          setRangeOpen(false);
        }}
      />
    </>
  );
}

function SlotRow({
  slot,
  showOffer,
  onSave,
}: {
  slot: RestaurantSlotDto;
  showOffer: boolean;
  onSave: (slot: RestaurantSlotDto, seatsTotal: number) => Promise<void>;
}) {
  // Draft value while the stepper is being tapped; the row remounts (by key) when the server answers.
  const [draft, setDraft] = useState(slot.seatsTotal);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const closed = draft <= slot.seatsBooked;
  const disabled = slot.started;

  const setSeats = (next: number, immediate = false) => {
    const value = Math.max(slot.seatsBooked, Math.min(MAX_SEATS, next));
    if (value === draft) return;
    haptic.select();
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void onSave(slot, value), immediate ? 0 : SAVE_DELAY_MS);
  };

  const status = slot.started
    ? "уже начался"
    : closed
      ? slot.seatsBooked > 0
        ? `закрыто · ${slot.seatsBooked} забронировано`
        : "закрыто для брони"
      : `занято ${slot.seatsBooked} из ${draft}`;

  return (
    <Card style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", opacity: disabled ? 0.55 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {slot.startTime}–{slot.endTime}
        </div>
        {showOffer && (
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {slot.offerTitle}
          </div>
        )}
        <div style={{ fontSize: "var(--font-size-sm)", color: closed && !slot.started ? "var(--color-danger)" : "var(--color-text-muted)" }}>
          {status}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
        <StepButton label="Меньше мест" disabled={disabled || draft <= slot.seatsBooked} onClick={() => setSeats(draft - 1)}>
          <MinusIcon style={{ width: 16, height: 16 }} />
        </StepButton>
        <span style={{ minWidth: 24, textAlign: "center", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{draft}</span>
        <StepButton label="Больше мест" disabled={disabled || draft >= MAX_SEATS} onClick={() => setSeats(draft + 1)}>
          <PlusIcon style={{ width: 16, height: 16 }} />
        </StepButton>
      </div>

      <Switch
        checked={!closed}
        disabled={disabled}
        label={closed ? "Открыть слот" : "Закрыть слот"}
        onChange={() => setSeats(closed ? Math.max(slot.seatsBooked + 1, slot.defaultSeats) : slot.seatsBooked, true)}
      />
    </Card>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="pressable"
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function RangeSheet({
  open,
  date,
  onClose,
  onDone,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onDone: (slots: RestaurantSlotDto[], message: string) => void;
}) {
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("23:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (action: "close" | "open") => {
    if (from >= to) {
      setError("Время «до» должно быть позже «с»");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiPatch<{ updated: number; slots: RestaurantSlotDto[] }>("/restaurant/slots", { date, from, to, action });
      haptic.success();
      onDone(
        result.slots,
        result.updated === 0
          ? "В этих часах нет слотов, которые можно изменить"
          : action === "close"
            ? `Закрыто слотов: ${result.updated}. Уже забронировавшие гости остаются.`
            : `Открыто слотов: ${result.updated}`,
      );
    } catch {
      haptic.error();
      setError("Не удалось применить, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Закрыть или открыть часы">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>Закрыть или открыть часы</h2>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
            Например, на время банкета. Гости, которые уже забронировали, останутся.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "var(--space-2)" }}>
          <input type="time" aria-label="С" value={from} step={1800} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          <span style={{ color: "var(--color-text-muted)" }}>—</span>
          <input type="time" aria-label="До" value={to} step={1800} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>

        <p style={{ margin: 0, minHeight: 20, fontSize: "var(--font-size-sm)", color: "var(--color-danger)" }}>{error}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <Button variant="secondary" disabled={busy} onClick={() => apply("open")} style={{ height: 52 }}>
            Открыть
          </Button>
          <Button disabled={busy} onClick={() => apply("close")} style={{ height: 52, background: "var(--color-danger)" }}>
            Закрыть для гостей
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
