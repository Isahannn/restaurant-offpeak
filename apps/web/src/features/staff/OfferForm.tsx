import { useState } from "react";
import type { OfferAdminDto } from "@app/shared";
import { apiPost } from "../../api/client";
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

interface OfferFormProps {
  onCancel: () => void;
  onCreated: (offer: OfferAdminDto) => void;
}

export function OfferForm({ onCancel, onCreated }: OfferFormProps) {
  const [title, setTitle] = useState("");
  const [discountPercent, setDiscountPercent] = useState("20");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4]);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("22:00");
  const [partialDiscount, setPartialDiscount] = useState(true);
  const [discountStart, setDiscountStart] = useState("15:00");
  const [discountEnd, setDiscountEnd] = useState("18:00");
  const [seatsPerSlot, setSeatsPerSlot] = useState(4);
  const [exceptions, setExceptions] = useState("");
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
      if (discountStart >= discountEnd) return "Окончание скидки должно быть позже начала";
      if (discountStart < startTime || discountEnd > endTime) return "Часы скидки должны быть внутри часов бронирования";
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
      const offer = await apiPost<OfferAdminDto>("/restaurant/offers", {
        title: title.trim(),
        discountPercent: discount,
        daysOfWeek,
        startTime,
        endTime,
        seatsPerSlot,
        exceptions: exceptions.split(",").map((e) => e.trim()).filter(Boolean),
        discountWindows: partialDiscount ? [{ startTime: discountStart, endTime: discountEnd }] : [],
      });
      onCreated(offer);
    } catch {
      setError("Не удалось сохранить предложение");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <SectionHeader title="Новое предложение" subtitle="Слоты на 2 недели появятся сразу после сохранения" />

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
          <Field label="Часы скидки">
            <TimeRange start={discountStart} end={discountEnd} onStart={setDiscountStart} onEnd={setDiscountEnd} />
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
