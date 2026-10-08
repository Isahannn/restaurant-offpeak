import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { BookingStatus, RestaurantBookingDto } from "@app/shared";
import { ApiError, apiGet, apiPatch, apiPost } from "../../api/client";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { formatDayLabel, shiftDate, toLocalDateString } from "./dates";
import { inputStyle } from "./inputStyle";
import { SectionHeader, StatusMessage } from "./ui";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; bookings: RestaurantBookingDto[] };

type CheckInFeedback = { tone: "success" | "error"; text: string } | null;

const CHECK_IN_ERRORS: Record<string, string> = {
  booking_not_found: "Бронь с таким кодом не найдена",
  already_arrived: "Гость уже отмечен",
  booking_cancelled: "Бронь отменена",
};

const STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  arrived: "Пришёл",
  no_show: "Не пришёл",
  cancelled: "Отменена",
};

function guestsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} гость`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} гостя`;
  return `${count} гостей`;
}

interface TodayTabProps {
  /** Changes whenever a live booking event arrives; triggers a silent refetch. */
  refreshKey: number;
  /** Bookings that just arrived live, shown highlighted for a few seconds. */
  freshIds: string[];
}

export function TodayTab({ refreshKey, freshIds }: TodayTabProps) {
  const [today] = useState(() => toLocalDateString(new Date()));
  const [date, setDate] = useState(today);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [code, setCode] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [feedback, setFeedback] = useState<CheckInFeedback>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ bookings: RestaurantBookingDto[] }>(`/restaurant/bookings?date=${date}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", bookings: data.bookings });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // refreshKey: live events refetch in place, keeping the current list on screen meanwhile.
  }, [date, refreshKey]);

  const changeDate = (days: number) => {
    setState({ status: "loading" });
    setDate(shiftDate(date, days));
  };

  const replaceBooking = (updated: RestaurantBookingDto) => {
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)) }
        : prev,
    );
  };

  const handleCheckIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || checkingIn) return;

    setCheckingIn(true);
    setFeedback(null);
    try {
      const booking = await apiPost<RestaurantBookingDto>("/restaurant/bookings/check-in", { code });
      setFeedback({
        tone: "success",
        text: `${booking.code} отмечен · ${guestsLabel(booking.partySize)}, ${booking.slotStartTime}`,
      });
      setCode("");
      if (booking.slotDate === date) replaceBooking(booking);
    } catch (err) {
      const reason = err instanceof ApiError ? err.reason : undefined;
      setFeedback({ tone: "error", text: (reason && CHECK_IN_ERRORS[reason]) ?? "Не удалось отметить, попробуйте ещё раз" });
    } finally {
      setCheckingIn(false);
    }
  };

  const mark = async (booking: RestaurantBookingDto, status: "arrived" | "no_show") => {
    setPendingId(booking.id);
    try {
      replaceBooking(await apiPatch<RestaurantBookingDto>(`/restaurant/bookings/${booking.id}`, { status }));
    } catch {
      setFeedback({ tone: "error", text: "Не удалось обновить бронь" });
    } finally {
      setPendingId(null);
    }
  };

  const activeBookings = state.status === "ready" ? state.bookings.filter((b) => b.status !== "cancelled") : [];
  const expectedGuests = activeBookings.reduce((sum, b) => sum + b.partySize, 0);

  return (
    <>
      <SectionHeader title="Отметить визит" subtitle="Введите код, который покажет гость" />

      <form onSubmit={handleCheckIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код брони"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={12}
            style={{ ...inputStyle, letterSpacing: "0.08em", fontWeight: 500 }}
          />
          <Button type="submit" disabled={!code.trim() || checkingIn} style={{ flexShrink: 0 }}>
            Отметить
          </Button>
        </div>
        <p
          style={{
            margin: 0,
            minHeight: 20,
            fontSize: "var(--font-size-sm)",
            color: feedback?.tone === "error" ? "var(--color-danger)" : "var(--color-accent-strong)",
          }}
        >
          {feedback?.text}
        </p>
      </form>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <DayButton label="Предыдущий день" onClick={() => changeDate(-1)}>
          <ChevronLeftIcon style={{ width: 16, height: 16 }} />
        </DayButton>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600 }}>{date === today ? "Сегодня" : formatDayLabel(date)}</div>
          <div style={{ minHeight: 20, fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
            {state.status === "ready" && `${activeBookings.length} брон. · ${guestsLabel(expectedGuests)}`}
          </div>
        </div>
        <DayButton label="Следующий день" onClick={() => changeDate(1)}>
          <ChevronRightIcon style={{ width: 16, height: 16 }} />
        </DayButton>
      </div>

      {state.status === "loading" && <StatusMessage>Загружаем брони…</StatusMessage>}
      {state.status === "error" && <StatusMessage>Не удалось загрузить брони</StatusMessage>}
      {state.status === "ready" && state.bookings.length === 0 && <StatusMessage>На этот день броней нет</StatusMessage>}

      {state.status === "ready" && state.bookings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {state.bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              fresh={freshIds.includes(booking.id)}
              disabled={pendingId === booking.id}
              onMark={(status) => mark(booking, status)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function DayButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function BookingRow({
  booking,
  fresh,
  disabled,
  onMark,
}: {
  booking: RestaurantBookingDto;
  fresh: boolean;
  disabled: boolean;
  onMark: (status: "arrived" | "no_show") => void;
}) {
  const isOpen = booking.status === "pending" || booking.status === "confirmed";

  return (
    <Card
      className={fresh ? "fade-up" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        opacity: booking.status === "cancelled" ? 0.6 : 1,
        transition: "border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)",
        // Only override when highlighted: an explicit `borderColor: undefined`
        // would reset Card's border shorthand to currentColor. Same border width
        // in both states, so the highlight never shifts the layout.
        ...(fresh ? { borderColor: "var(--color-accent)", boxShadow: "0 0 0 3px var(--color-accent-soft)" } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>{booking.slotStartTime}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            {guestsLabel(booking.partySize)}
          </span>
        </div>
        <span style={{ fontWeight: 500, letterSpacing: "0.08em", fontSize: "var(--font-size-sm)" }}>{booking.code}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          <span style={{ fontSize: "var(--font-size-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {booking.offerTitle}
          </span>
          {booking.discountPercent > 0 && <Badge>−{booking.discountPercent}%</Badge>}
        </div>

        {isOpen ? (
          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
            <Button variant="secondary" disabled={disabled} onClick={() => onMark("no_show")} style={{ height: 36, fontSize: "var(--font-size-sm)" }}>
              Не пришёл
            </Button>
            <Button disabled={disabled} onClick={() => onMark("arrived")} style={{ height: 36, fontSize: "var(--font-size-sm)" }}>
              Пришёл
            </Button>
          </div>
        ) : (
          <span
            style={{
              flexShrink: 0,
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              color: booking.status === "arrived" ? "var(--color-accent-strong)" : "var(--color-text-muted)",
            }}
          >
            {STATUS_LABELS[booking.status]}
          </span>
        )}
      </div>
    </Card>
  );
}
