import type { ReactNode } from "react";

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
      {children}
    </p>
  );
}
