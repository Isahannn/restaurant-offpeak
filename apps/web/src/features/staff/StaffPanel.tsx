import { useState } from "react";
import { OffersTab } from "./OffersTab";
import { StaffTabBar, TAB_BAR_HEIGHT, type StaffTab } from "./StaffTabBar";
import { StatsTab } from "./StatsTab";
import { TodayTab } from "./TodayTab";

export function StaffPanel() {
  const [tab, setTab] = useState<StaffTab>("today");

  return (
    <>
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          padding: "var(--space-5) var(--space-4)",
          paddingBottom: `calc(${TAB_BAR_HEIGHT}px + var(--space-5) + env(safe-area-inset-bottom))`,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {tab === "today" && <TodayTab />}
        {tab === "offers" && <OffersTab />}
        {tab === "stats" && <StatsTab />}
      </main>
      <StaffTabBar active={tab} onChange={setTab} />
    </>
  );
}
