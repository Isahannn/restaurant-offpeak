import type { ComponentType, SVGProps } from "react";
import { haptic } from "../theme/haptics";

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Small dot on the icon, e.g. for unseen updates. */
  badge?: boolean;
}

interface TabBarProps<Id extends string> {
  tabs: TabItem<Id>[];
  active: Id;
  onChange: (tab: Id) => void;
}

/** Fixed bottom navigation. Only colour changes between states, so nothing shifts on tap. */
export function TabBar<Id extends string>({ tabs, active, onChange }: TabBarProps<Id>) {
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        borderTop: "1px solid var(--color-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          height: "var(--tab-bar-height)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        }}
      >
        {tabs.map(({ id, label, Icon, badge }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!isActive) haptic.select();
                onChange(id);
              }}
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
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                transition: "color var(--duration-fast) var(--ease-out)",
              }}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                <Icon style={{ width: 22, height: 22, flexShrink: 0 }} />
                {badge && (
                  <span
                    aria-label="есть обновления"
                    style={{
                      position: "absolute",
                      top: -1,
                      right: -3,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--color-danger)",
                      boxShadow: "0 0 0 2px var(--color-bg)",
                    }}
                  />
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
