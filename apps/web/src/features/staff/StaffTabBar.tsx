import type { ComponentType, SVGProps } from "react";
import { ChartBarIcon, ClipboardDocumentCheckIcon, TagIcon } from "@heroicons/react/24/outline";

export type StaffTab = "today" | "offers" | "stats";

const TABS: Array<{ id: StaffTab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: "today", label: "Сегодня", Icon: ClipboardDocumentCheckIcon },
  { id: "offers", label: "Предложения", Icon: TagIcon },
  { id: "stats", label: "Статистика", Icon: ChartBarIcon },
];

export const TAB_BAR_HEIGHT = 60;

interface StaffTabBarProps {
  active: StaffTab;
  onChange: (tab: StaffTab) => void;
}

export function StaffTabBar({ active, onChange }: StaffTabBarProps) {
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        background: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          height: TAB_BAR_HEIGHT,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-1)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                // Only color changes between states, so nothing shifts on tap.
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
              }}
            >
              <Icon style={{ width: 22, height: 22, flexShrink: 0 }} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
