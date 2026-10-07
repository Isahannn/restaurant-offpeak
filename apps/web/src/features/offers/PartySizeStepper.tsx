import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";

interface PartySizeStepperProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}

const stepButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
};

export function PartySizeStepper({ value, max, onChange, label = "Гостей" }: PartySizeStepperProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      {label && (
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{label}</span>
      )}
      <button
        type="button"
        style={{ ...stepButtonStyle, opacity: value <= 1 ? 0.4 : 1 }}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Уменьшить количество гостей"
      >
        <MinusIcon style={{ width: 16, height: 16 }} />
      </button>
      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{value}</span>
      <button
        type="button"
        style={{ ...stepButtonStyle, opacity: value >= max ? 0.4 : 1 }}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Увеличить количество гостей"
      >
        <PlusIcon style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}
