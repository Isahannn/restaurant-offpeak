import { TagIcon } from "@heroicons/react/24/solid";
import { TicketIcon } from "@heroicons/react/24/outline";

interface NavProps {
  onLogoClick: () => void;
  onMyBookingsClick?: () => void;
  /** Shown on the right instead of the bookings button (restaurant staff mode). */
  restaurantName?: string;
}

export function Nav({ onLogoClick, onMyBookingsClick, restaurantName }: NavProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "var(--space-3) var(--space-4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
        }}
      >
        <button
          type="button"
          onClick={onLogoClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-accent)",
              color: "var(--color-accent-contrast)",
              flexShrink: 0,
            }}
          >
            <TagIcon style={{ width: 16, height: 16 }} />
          </span>
          <span style={{ fontSize: "var(--font-size-md)", fontWeight: 600, color: "var(--color-text)" }}>
            TheFood
          </span>
        </button>

        {restaurantName ? (
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            {restaurantName}
          </span>
        ) : onMyBookingsClick ? (
          <button
            type="button"
            onClick={onMyBookingsClick}
            aria-label="Мои брони"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "none",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <TicketIcon style={{ width: 16, height: 16 }} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
