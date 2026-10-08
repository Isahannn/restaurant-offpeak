import { useEffect, useState } from "react";
import type { RestaurantDayStatsDto } from "@app/shared";
import { apiGet } from "../../api/client";
import { Card } from "../../components/Card";
import { formatDayLabel, shiftDate, toLocalDateString } from "./dates";
import { SectionHeader, StatusMessage } from "./ui";

type Period = "past" | "upcoming";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; days: RestaurantDayStatsDto[] };

const PERIOD_DAYS = 7;

export function StatsTab({ refreshKey }: { refreshKey: number }) {
  const [period, setPeriod] = useState<Period>("past");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const today = toLocalDateString(new Date());
    const from = period === "past" ? shiftDate(today, -(PERIOD_DAYS - 1)) : today;

    apiGet<{ days: RestaurantDayStatsDto[] }>(`/restaurant/stats?from=${from}&days=${PERIOD_DAYS}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", days: data.days });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey]);

  const totals =
    state.status === "ready"
      ? state.days.reduce(
          (acc, d) => ({
            seatsTotal: acc.seatsTotal + d.seatsTotal,
            seatsBooked: acc.seatsBooked + d.seatsBooked,
            arrived: acc.arrived + d.arrived,
            noShow: acc.noShow + d.noShow,
          }),
          { seatsTotal: 0, seatsBooked: 0, arrived: 0, noShow: 0 },
        )
      : null;

  return (
    <>
      <SectionHeader title="Статистика" subtitle="Заполненность слотов по дням" />

      <SegmentedControl
        value={period}
        onChange={(next) => {
          if (next === period) return;
          setState({ status: "loading" });
          setPeriod(next);
        }}
      />

      {state.status === "loading" && <StatusMessage>Считаем…</StatusMessage>}
      {state.status === "error" && <StatusMessage>Не удалось загрузить статистику</StatusMessage>}

      {state.status === "ready" && totals && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
            <StatTile label="Заполнено" value={`${percent(totals.seatsBooked, totals.seatsTotal)}%`} />
            <StatTile label="Пришли" value={String(totals.arrived)} />
            <StatTile label="Не пришли" value={String(totals.noShow)} />
          </div>

          <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {state.days.map((day) => (
              <DayBar key={day.date} day={day} />
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function SegmentedControl({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  const options: Array<{ id: Period; label: string }> = [
    { id: "past", label: "Прошедшие 7 дней" },
    { id: "upcoming", label: "Следующие 7 дней" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        padding: 2,
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-muted)",
        border: "1px solid var(--color-border)",
      }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            style={{
              height: 36,
              border: "none",
              borderRadius: "calc(var(--radius-md) - 2px)",
              background: selected ? "var(--color-surface)" : "transparent",
              boxShadow: selected ? "0 1px 2px rgba(0, 0, 0, 0.08)" : "none",
              color: selected ? "var(--color-text)" : "var(--color-text-muted)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{label}</span>
    </Card>
  );
}

function DayBar({ day }: { day: RestaurantDayStatsDto }) {
  const fill = percent(day.seatsBooked, day.seatsTotal);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
        <span>{formatDayLabel(day.date)}</span>
        <span style={{ color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {day.seatsTotal === 0 ? "нет слотов" : `${day.seatsBooked} из ${day.seatsTotal} · ${fill}%`}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--color-surface-muted)", overflow: "hidden" }}>
        <div style={{ width: `${fill}%`, height: "100%", borderRadius: 3, background: "var(--color-accent)" }} />
      </div>
    </div>
  );
}
