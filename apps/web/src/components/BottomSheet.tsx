import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible name for the dialog. */
  label: string;
}

/** Slide-up panel for focused tasks like booking; tap outside or Esc to close. */
export function BottomSheet({ open, onClose, children, label }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const { overflow } = document.body.style;
    // Lock the page behind the sheet so only the sheet scrolls.
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(10, 14, 12, 0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "backdrop-in var(--duration-base) var(--ease-out)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--space-2) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom))",
          animation: "sheet-in var(--duration-base) var(--ease-out)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--color-border)",
            margin: "0 auto var(--space-4)",
          }}
        />
        {children}
      </div>
    </div>,
    document.body,
  );
}
