import { ChartBarIcon, ClipboardDocumentCheckIcon, Squares2X2Icon, TagIcon } from "@heroicons/react/24/outline";
import { TabBar } from "../../components/TabBar";

export type StaffTab = "today" | "seats" | "offers" | "stats";

interface StaffTabBarProps {
  active: StaffTab;
  onChange: (tab: StaffTab) => void;
  /** Dot on "Сегодня" when bookings changed while another tab was open. */
  todayHasUpdates: boolean;
}

export function StaffTabBar({ active, onChange, todayHasUpdates }: StaffTabBarProps) {
  return (
    <TabBar
      active={active}
      onChange={onChange}
      tabs={[
        { id: "today", label: "Сегодня", Icon: ClipboardDocumentCheckIcon, badge: todayHasUpdates },
        { id: "seats", label: "Места", Icon: Squares2X2Icon },
        { id: "offers", label: "Предложения", Icon: TagIcon },
        { id: "stats", label: "Статистика", Icon: ChartBarIcon },
      ]}
    />
  );
}
