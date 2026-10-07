import { useState } from "react";
import type { SlotDto } from "@app/shared";
import { formatSlotLabel } from "./formatSlotLabel";

interface SlotPickerProps {
  slots: SlotDto[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
}

function groupByDate(slots: SlotDto[]): Map<string, SlotDto[]> {
  const map = new Map<string, SlotDto[]>();
  for (const slot of slots) {
    const list = map.get(slot.date);
    if (list) {
      list.push(slot);
    } else {
      map.set(slot.date, [slot]);
    }
  }
  return map;
}

const pillBaseStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-1)",
  padding: "var(--space-2) var(--space-3)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  fontWeight: 500,
  lineHeight: 1.3,
  cursor: "pointer",
};

export function SlotPicker({ slots, selectedSlotId, onSelect }: SlotPickerProps) {
  const byDate = groupByDate(slots);
  const dates = [...byDate.keys()];
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const [activeDate, setActiveDate] = useState<string>(selectedSlot?.date ?? dates[0] ?? "");

  const hourSlots = byDate.get(activeDate) ?? [];

  function handleDateClick(date: string) {
    setActiveDate(date);
    const firstAvailable = (byDate.get(date) ?? []).find((s) => s.seatsTotal - s.seatsBooked > 0);
    if (firstAvailable) onSelect(firstAvailable.id);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {dates.map((date) => {
          const active = date === activeDate;
          return (
            <button
              key={date}
              type="button"
              onClick={() => handleDateClick(date)}
              style={{
                ...pillBaseStyle,
                border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                background: active ? "var(--color-accent-soft)" : "var(--color-surface)",
                color: "var(--color-text)",
              }}
            >
              {formatSlotLabel(date)}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {hourSlots.map((slot) => {
          const seatsAvailable = slot.seatsTotal - slot.seatsBooked;
          const soldOut = seatsAvailable <= 0;
          const selected = slot.id === selectedSlotId;

          return (
            <button
              key={slot.id}
              type="button"
              disabled={soldOut}
              onClick={() => onSelect(slot.id)}
              style={{
                ...pillBaseStyle,
                border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border)"}`,
                background: selected ? "var(--color-accent-soft)" : "var(--color-surface)",
                color: soldOut ? "var(--color-text-muted)" : "var(--color-text)",
                cursor: soldOut ? "not-allowed" : "pointer",
                opacity: soldOut ? 0.5 : 1,
                textDecoration: soldOut ? "line-through" : "none",
              }}
            >
              <span>
                {slot.startTime}–{slot.endTime}
              </span>
              {slot.discountPercent > 0 && (
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    fontWeight: 600,
                    color: soldOut ? "var(--color-text-muted)" : "var(--color-accent-strong)",
                  }}
                >
                  −{slot.discountPercent}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
