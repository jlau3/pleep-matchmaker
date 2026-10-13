"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { takeVotesChanged } from "@/lib/votesChanged";

/** After voting on My Votes, refreshes the next page you open so it reflects your new votes. */
export function VotesChangedRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname !== "/vote" && pathname !== "/pick" && takeVotesChanged()) router.refresh();
  }, [pathname, router]);
  return null;
}
