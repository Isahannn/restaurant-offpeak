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
        // Translucent text colour reads on any background: page, card or sheet.
        background: "color-mix(in srgb, var(--color-text) 9%, transparent)",
        animation: "skeleton-pulse 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
