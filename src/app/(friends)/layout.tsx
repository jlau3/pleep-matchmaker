import { ActiveSubTabs } from "@/components/ActiveSubTabs";
import { FRIENDS_TABS } from "@/components/SubTabs";

/** My Friends and Find New Friends share their tab switch. */
export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ActiveSubTabs tabs={FRIENDS_TABS} />
      {children}
    </div>
  );
}
