import { ActiveSubTabs } from "@/components/ActiveSubTabs";
import { PROFILE_TABS } from "@/components/SubTabs";

/** My Votes and Profile share their tab switch. */
export default function YouLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ActiveSubTabs tabs={PROFILE_TABS} />
      {children}
    </div>
  );
}
