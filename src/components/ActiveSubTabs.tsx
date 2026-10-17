"use client";

import { usePathname } from "next/navigation";
import { SubTabs } from "./SubTabs";

/**
 * SubTabs for a route group's layout, so the switch stays on screen while the
 * other page loads (each page's loading.tsx renders below the layout).
 */
export function ActiveSubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return <SubTabs tabs={tabs} active={tabs.find((tab) => pathname.startsWith(tab.href))?.href ?? ""} />;
}
