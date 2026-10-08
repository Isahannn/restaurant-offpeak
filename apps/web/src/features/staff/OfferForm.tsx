import { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { OfferAdminDto } from "@app/shared";
import { apiPatch, apiPost } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PartySizeStepper } from "../offers/PartySizeStepper";
import { inputStyle } from "./inputStyle";
import { SectionHeader } from "./ui";

// Monday-first, values match Date#getUTCDay().
const WEEK_DAYS = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

const MAX_SEATS_PER_SLOT = 50;
/** Same limit as the API. */
const MAX_DISCOUNT_WINDOWS = 4;

interface TimeWindow {
  startTime: string;
  endTime: string;
}

interface ScheduleChange {
  created: number;
  updated: number;
  removed: number;
  keptBooked: number;
}

interface OfferFormProps {
  /** Existing offer to edit; omit to create a new one. */
  initial?: OfferAdminDto;
  onCancel: () => void;
  /** `note` summarises how an edit changed the offer's upcoming slots. */
  onSaved: (offer: OfferAdminDto, note?: string) => void;
}

function describeScheduleChange({ created, removed, keptBooked }: ScheduleChange): string {
  const parts = [];
  if (created > 0) parts.push(`новых слотов: ${created}`);
  if (removed > 0) parts.push(`убрано пустых: ${removed}`);
  const changes = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  const kept = keptBooked > 0 ? `. Слоты с бронями гостей (${keptBooked}) остались на прежних условиях` : "";
  return `Сохранено${changes}${kept}`;
}

export function OfferForm({ initial, onCancel, onSaved }: OfferFormProps) {

  const [title, setTitle] = useState(initial?.title ?? "");
  const [discountPercent, setDiscountPercent] = useState(String(initial?.discountPercent ?? 20));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial?.daysOfWeek ?? [1, 2, 3, 4]);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "12:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "22:00");
  const [partialDiscount, setPartialDiscount] = useState(initial ? initial.discountWindows.length > 0 : true);
  const [windows, setWindows] = useState<TimeWindow[]>(
    initial && initial.discountWindows.length > 0
      ? initial.discountWindows.map((w) => ({ startTime: w.startTime, endTime: w.endTime }))
      : [{ startTime: "15:00", endTime: "18:00" }],
  );
  const [seatsPerSlot, setSeatsPerSlot] = useState(initial?.seatsPerSlot ?? 4);
  const [exceptions, setExceptions] = useState(initial?.exceptions.join(", ") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const discount = Number(discountPercent);

  const validationError = (() => {
    if (!title.trim()) return "Укажите название";
    if (!Number.isInteger(discount) || discount < 1 || discount > 90) return "Скидка — от 1 до 90%";
    if (daysOfWeek.length === 0) return "Выберите хотя бы один день";
    if (startTime >= endTime) return "Время окончания должно быть позже начала";
    if (partialDiscount) {
      if (windows.some((w) => w.startTime >= w.endTime)) return "В каждом окне скидки конец должен быть позже начала";
      if (windows.some((w) => w.startTime < startTime || w.endTime > endTime)) return "Часы скидки должны быть внутри часов бронирования";
      const sorted = [...windows].sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (sorted.some((w, i) => i > 0 && w.startTime < sorted[i - 1].endTime)) return "Окна скидки не должны пересекаться";
    }
    return null;
  })();

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (validationError || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        discountPercent: discount,
        daysOfWeek,
        startTime,
        endTime,
        seatsPerSlot,
        exceptions: exceptions.split(",").map((e) => e.trim()).filter(Boolean),
        discountWindows: partialDiscount ? windows : [],
      };
      if (initial) {
        const { schedule, ...offer } = await apiPatch<OfferAdminDto & { schedule: ScheduleChange }>(
          `/restaurant/offers/${initial.id}`,
          payload,
        );
        onSaved(offer, describeScheduleChange(schedule));
      } else {
        onSaved(await apiPost<OfferAdminDto>("/restaurant/offers", payload));
      }
    } catch {
      setError("Не удалось сохранить предложение");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <SectionHeader
        title={initial ? "Редактировать предложение" : "Новое предложение"}
        subtitle={
          initial
            ? "Свободные слоты перестроятся под новое расписание. Брони гостей сохранятся на прежних условиях"
            : "Слоты на 2 недели появятся сразу после сохранения"
        }
      />

      <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Field label="Название">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Тихий обед" maxLength={60} style={inputStyle} />
        </Field>

        <Field label="Скидка, %">
          <input
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={2}
            style={{ ...inputStyle, width: 96 }}
          />
        </Field>

        <Field label="Дни недели">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-1)" }}>
            {WEEK_DAYS.map(({ value, label }) => {
              const selected = daysOfWeek.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleDay(value)}
                  style={{
                    height: 36,
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border)"}`,
                    background: selected ? "var(--color-accent-soft)" : "var(--color-surface)",
                    color: selected ? "var(--color-accent-strong)" : "var(--color-text)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Часы бронирования">
          <TimeRange start={startTime} end={endTime} onStart={setStartTime} onEnd={setEndTime} />
        </Field>

        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--font-size-sm)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={partialDiscount}
            onChange={(e) => setPartialDiscount(e.target.checked)}
            style={{ width: 18, height: 18, margin: 0, accentColor: "var(--color-accent)" }}
          />
          Скидка только в часть времени
        </label>

        {partialDiscount && (
          <Field label="Часы скидки" hint="можно несколько окон">
            <DiscountWindows windows={windows} onChange={setWindows} defaultEnd={endTime} />
          </Field>
        )}

        <Field label="Мест на один слот">
          <PartySizeStepper value={seatsPerSlot} max={MAX_SEATS_PER_SLOT} onChange={setSeatsPerSlot} label="" />
        </Field>

        <Field label="Не участвуют в скидке" hint="через запятую, необязательно">
          <input value={exceptions} onChange={(e) => setExceptions(e.target.value)} placeholder="Алкоголь, бизнес-ланч" style={inputStyle} />
        </Field>
      </Card>

      <p style={{ margin: 0, minHeight: 20, fontSize: "var(--font-size-sm)", color: "var(--color-danger)" }}>
        {error ?? (attempted ? validationError : null) ?? ""}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={submitting}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}> · {hint}</span>}
      </span>
      {children}
    </div>
  );
}

function TimeRange({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "var(--space-2)" }}>
      <input type="time" value={start} onChange={(e) => onStart(e.target.value)} step={1800} style={inputStyle} />
      <span style={{ color: "var(--color-text-muted)" }}>—</span>
      <input type="time" value={end} onChange={(e) => onEnd(e.target.value)} step={1800} style={inputStyle} />
    </div>
  );
}

/** Editable list of discount windows: remove any (keeping at least one), add up to the limit. */
function DiscountWindows({
  windows,
  onChange,
  defaultEnd,
}: {
  windows: TimeWindow[];
  onChange: (windows: TimeWindow[]) => void;
  defaultEnd: string;
}) {
  const update = (index: number, patch: Partial<TimeWindow>) =>
    onChange(windows.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  const add = () => {
    // Start the new window where the last one ends, one hour long.
    const last = windows[windows.length - 1];
    const [h, m] = (last?.endTime ?? "15:00").split(":").map(Number);
    const start = `${String(Math.min(h + 1, 22)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onChange([...windows, { startTime: start, endTime: end <= defaultEnd ? end : defaultEnd }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {windows.map((w, index) => (
        <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 36px", alignItems: "center", gap: "var(--space-2)" }}>
          <input
            type="time"
            aria-label={`Начало окна ${index + 1}`}
            value={w.startTime}
            step={1800}
            onChange={(e) => update(index, { startTime: e.target.value })}
            style={inputStyle}
          />
          <span style={{ color: "var(--color-text-muted)" }}>—</span>
          <input
            type="time"
            aria-label={`Конец окна ${index + 1}`}
            value={w.endTime}
            step={1800}
            onChange={(e) => update(index, { endTime: e.target.value })}
            style={inputStyle}
          />
          {/* Keep the column even with one window so rows never shift. */}
          {windows.length > 1 ? (
            <button
              type="button"
              aria-label={`Удалить окно ${index + 1}`}
              onClick={() => onChange(windows.filter((_, i) => i !== index))}
              className="pressable"
              style={{
                width: 36,
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {windows.length < MAX_DISCOUNT_WINDOWS && (
        <button
          type="button"
          onClick={add}
          className="pressable"
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            padding: 0,
            border: "none",
            background: "none",
            color: "var(--color-accent-strong)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <PlusIcon style={{ width: 16, height: 16 }} />
          Ещё окно
        </button>
      )}
    </div>
  );
}
