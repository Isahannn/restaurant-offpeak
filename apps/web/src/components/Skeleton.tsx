import type { CSSProperties } from "react";

/** Placeholder block shown while content loads, shaped like what it replaces. */
export function Skeleton({ width = "100%", height, radius = "var(--radius-sm)", style }: {
  width?: CSSProperties["width"];
  height: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius,
        background: "var(--color-surface-muted)",
        animation: "skeleton-pulse 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
