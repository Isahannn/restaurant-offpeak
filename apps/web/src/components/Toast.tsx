import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onDone: () => void;
  durationMs?: number;
}

/** Short status pill above the tab bar; disappears on its own. */
export function Toast({ message, onDone, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDone, durationMs]);

  if (!message) return null;

  return (
    // Outer layer centres; only the inner pill animates, so the entrance
    // transform never fights the centring.
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + var(--space-3))",
        zIndex: 20,
        display: "flex",
        justifyContent: "center",
        padding: "0 var(--space-4)",
        pointerEvents: "none",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        // Re-keying by message replays the entrance animation for each new toast.
        key={message}
        className="fade-up"
        style={{
          maxWidth: "100%",
          padding: "var(--space-2) var(--space-4)",
          borderRadius: "var(--radius-pill)",
          background: "var(--color-text)",
          color: "var(--color-bg)",
          fontSize: "var(--font-size-sm)",
          fontWeight: 500,
          boxShadow: "var(--shadow-md)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {message}
      </div>
    </div>
  );
}
