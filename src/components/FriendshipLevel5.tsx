"use client";

import { useEffect, useState } from "react";
import { DAYS_TO_FRIENDSHIP_LEVEL_5, friendshipLevel5Date } from "@/lib/friendship";

/**
 * "Add someone today: friendship level 5 on Jan 21, 2027." Worked out in the
 * browser so the date follows the player's own calendar, not the server's.
 */
export function FriendshipLevel5() {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    setDate(friendshipLevel5Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
  }, []);
  if (!date) return null;
  return (
    <p className="text-sm text-slate-600 dark:text-slate-300">
      🤝 Add someone today and you&apos;ll reach friendship level 5 on <strong>{date}</strong> ({DAYS_TO_FRIENDSHIP_LEVEL_5}{" "}
      days).
    </p>
  );
}
