import { lazy, Suspense, useEffect, useState } from "react";
import { HomeIcon, TicketIcon } from "@heroicons/react/24/outline";
import { apiGet } from "./api/client";
import { Nav } from "./components/Nav";
import { Skeleton } from "./components/Skeleton";
import { TabBar } from "./components/TabBar";
import { OffersFeed } from "./features/offers/OffersFeed";

// Split by audience and by screen: guests never download the staff panel, and
// secondary screens load on first visit instead of with the feed.
const StaffPanel = lazy(() => import("./features/staff/StaffPanel").then((m) => ({ default: m.StaffPanel })));
const loadRestaurantPage = () => import("./features/restaurant/RestaurantPage");
const loadMyBookingsPage = () => import("./features/bookings/MyBookingsPage");
const RestaurantPage = lazy(() => loadRestaurantPage().then((m) => ({ default: m.RestaurantPage })));
const MyBookingsPage = lazy(() => loadMyBookingsPage().then((m) => ({ default: m.MyBookingsPage })));

/** Shown for the split second a lazy screen's code is still loading. */
function ScreenFallback() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4)" }}>
      <Skeleton height={undefined} radius="var(--radius-xl)" style={{ aspectRatio: "16 / 11" }} />
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} width="55%" />
    </div>
  );
}

type GuestTab = "feed" | "bookings";

type Role = { role: "guest" } | { role: "staff"; restaurantId: string; restaurantName: string };

const pageStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  maxWidth: 480,
  margin: "0 auto",
  padding: "var(--space-5) var(--space-4)",
  paddingBottom: "calc(var(--tab-bar-height) + var(--space-6) + env(safe-area-inset-bottom))",
};

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<GuestTab>("feed");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Role>("/me/role")
      .then(setRole)
      // Outside Telegram (no initData) or API hiccup: fall back to the guest experience.
      .catch(() => setRole({ role: "guest" }));
  }, []);

  // Once the guest sees the feed, fetch the other screens' code in the background
  // so opening a restaurant or the bookings tab is instant.
  useEffect(() => {
    if (role?.role !== "guest") return;
    const prefetch = () => {
      void loadRestaurantPage();
      void loadMyBookingsPage();
    };
    const idle = window.requestIdleCallback?.(prefetch) ?? window.setTimeout(prefetch, 1500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, [role]);

  // Each screen starts at the top, like a native app.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, restaurantId]);

  if (!role) {
    return null;
  }

  if (role.role === "staff") {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Nav onLogoClick={() => undefined} restaurantName={role.restaurantName} />
        <Suspense fallback={null}>
          <StaffPanel />
        </Suspense>
      </div>
    );
  }

  const changeTab = (next: GuestTab) => {
    setRestaurantId(null);
    setTab(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {restaurantId ? (
        <main style={{ flex: 1, paddingBottom: "calc(var(--tab-bar-height) + var(--space-6) + env(safe-area-inset-bottom))" }}>
          <Suspense fallback={<ScreenFallback />}>
            <RestaurantPage restaurantId={restaurantId} onBack={() => setRestaurantId(null)} />
          </Suspense>
        </main>
      ) : (
        <>
          <Nav onLogoClick={() => changeTab("feed")} />
          <main style={pageStyle}>
            {tab === "feed" && <OffersFeed onOpenRestaurant={setRestaurantId} />}
            {tab === "bookings" && (
              <Suspense fallback={<ScreenFallback />}>
                <MyBookingsPage />
              </Suspense>
            )}
          </main>
        </>
      )}

      <TabBar
        active={tab}
        onChange={changeTab}
        tabs={[
          { id: "feed", label: "Лента", Icon: HomeIcon },
          { id: "bookings", label: "Мои брони", Icon: TicketIcon },
        ]}
      />
    </div>
  );
}

export default App;
