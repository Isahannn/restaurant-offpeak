import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  selected?: boolean;
  children: ReactNode;
  /** Secondary line, e.g. the discount under a time. */
  hint?: ReactNode;
}

/**
 * Pill button for filters, dates and times. Selected and idle states differ
 * only in colour — same size and border width — so a tap never shifts layout.
 */
export function Chip({ selected = false, hint, children, disabled, style, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={["pressable", className].filter(Boolean).join(" ")}
      {...props}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minHeight: hint ? 52 : 36,
        padding: "0 var(--space-3)",
        borderRadius: hint ? "var(--radius-md)" : "var(--radius-pill)",
        border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border)"}`,
        background: selected ? "var(--color-accent)" : "var(--color-surface)",
        color: selected ? "var(--color-accent-contrast)" : "var(--color-text)",
        fontSize: "var(--font-size-sm)",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
        ...style,
      }}
    >
      <span>{children}</span>
      {hint && (
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            color: selected ? "var(--color-accent-contrast)" : "var(--color-accent-strong)",
          }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}
