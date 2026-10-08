import { useCallback, useEffect, useRef, useState } from "react";
import { useBookingEvents, type BookingEvent } from "../../api/eventStream";
import { Toast } from "../../components/Toast";
import { haptic } from "../../theme/haptics";
import { OffersTab } from "./OffersTab";
import { SeatsTab } from "./SeatsTab";
import { StaffTabBar, type StaffTab } from "./StaffTabBar";
import { StatsTab } from "./StatsTab";
import { TodayTab } from "./TodayTab";

/** How long a just-arrived booking stays highlighted in the list. */
const HIGHLIGHT_MS = 8000;

export function StaffPanel() {
  const [tab, setTab] = useState<StaffTab>("today");
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  // Bumped on every live event so the open tab refetches silently.
  const [refreshKey, setRefreshKey] = useState(0);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const [todayHasUpdates, setTodayHasUpdates] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const onEvent = (event: BookingEvent) => {
    setRefreshKey((k) => k + 1);
    if (tabRef.current !== "today") setTodayHasUpdates(true);

    if (event.type === "created") {
      haptic.success();
      setToast("Новая бронь");
      setFreshIds((ids) => [...ids, event.bookingId]);
      setTimeout(() => setFreshIds((ids) => ids.filter((id) => id !== event.bookingId)), HIGHLIGHT_MS);
    } else if (event.status === "cancelled") {
      haptic.tap();
      setToast("Гость отменил бронь");
    }
  };

  // After a dropped connection, refetch once: events may have been missed.
  useBookingEvents(onEvent, () => setRefreshKey((k) => k + 1));

  const changeTab = (next: StaffTab) => {
    if (next === "today") setTodayHasUpdates(false);
    setTab(next);
  };

  return (
    <>
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          padding: "var(--space-5) var(--space-4)",
          paddingBottom: "calc(var(--tab-bar-height) + var(--space-5) + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {tab === "today" && <TodayTab refreshKey={refreshKey} freshIds={freshIds} />}
        {tab === "seats" && <SeatsTab refreshKey={refreshKey} />}
        {tab === "offers" && <OffersTab />}
        {tab === "stats" && <StatsTab refreshKey={refreshKey} />}
      </main>
      <Toast message={toast} onDone={clearToast} />
      <StaffTabBar active={tab} onChange={changeTab} todayHasUpdates={todayHasUpdates} />
    </>
  );
}
