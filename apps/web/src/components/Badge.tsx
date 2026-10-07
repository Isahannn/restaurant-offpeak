import type { HTMLAttributes } from "react";

export function Badge({ style, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-accent-soft)",
        color: "var(--color-accent-strong)",
        fontSize: "var(--font-size-xs)",
        fontWeight: 600,
        ...style,
      }}
    />
  );
}
