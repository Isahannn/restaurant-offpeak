import type { ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { formatDayLabel } from "./dates";

interface DayNavigatorProps {
  date: string;
  today: string;
  onShift: (days: number) => void;
  /** Line under the date, e.g. "3 брон. · 5 гостей"; space is reserved so nothing jumps. */
  subtitle?: ReactNode;
}

export function DayNavigator({ date, today, onShift, subtitle }: DayNavigatorProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
      <DayButton label="Предыдущий день" onClick={() => onShift(-1)}>
        <ChevronLeftIcon style={{ width: 16, height: 16 }} />
      </DayButton>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 600 }}>{date === today ? "Сегодня" : formatDayLabel(date)}</div>
        <div style={{ minHeight: 20, fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{subtitle}</div>
      </div>
      <DayButton label="Следующий день" onClick={() => onShift(1)}>
        <ChevronRightIcon style={{ width: 16, height: 16 }} />
      </DayButton>
    </div>
  );
}

function DayButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pressable"
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
