import { useEffect, useState } from "react";
import { apiGet } from "./api/client";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { MyBookingsPage } from "./features/bookings/MyBookingsPage";
import { OffersFeed } from "./features/offers/OffersFeed";
import { RestaurantPage } from "./features/restaurant/RestaurantPage";
import { StaffPanel } from "./features/staff/StaffPanel";

type View = { type: "feed" } | { type: "restaurant"; restaurantId: string } | { type: "my-bookings" };

type Role = { role: "guest" } | { role: "staff"; restaurantId: string; restaurantName: string };

function App() {
  const [view, setView] = useState<View>({ type: "feed" });
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    apiGet<Role>("/me/role")
      .then(setRole)
      // Outside Telegram (no initData) or API hiccup: fall back to the guest experience.
      .catch(() => setRole({ role: "guest" }));
  }, []);

  if (!role) {
    return null;
  }

  if (role.role === "staff") {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Nav onLogoClick={() => undefined} restaurantName={role.restaurantName} />
        <StaffPanel />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Nav
        onLogoClick={() => setView({ type: "feed" })}
        onMyBookingsClick={() => setView({ type: "my-bookings" })}
      />

      {view.type === "feed" && (
        <main
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 480,
            margin: "0 auto",
            padding: "var(--space-5) var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          <header>
            <h1 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
              Предложения рядом
            </h1>
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)" }}>
              Скидки на свободные столики
            </p>
          </header>

          <OffersFeed
            onOpenRestaurant={(restaurantId) => setView({ type: "restaurant", restaurantId })}
          />
        </main>
      )}

      {view.type === "restaurant" && (
        <main style={{ flex: 1, width: "100%", padding: "var(--space-5) 0" }}>
          <RestaurantPage
            restaurantId={view.restaurantId}
            onBack={() => setView({ type: "feed" })}
          />
        </main>
      )}

      {view.type === "my-bookings" && (
        <main style={{ flex: 1, width: "100%", padding: "var(--space-5) 0" }}>
          <MyBookingsPage onBack={() => setView({ type: "feed" })} />
        </main>
      )}

      <Footer />
    </div>
  );
}

export default App;
