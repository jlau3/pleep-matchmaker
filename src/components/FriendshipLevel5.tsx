"use client";

import { useEffect, useState } from "react";
import { DAYS_TO_FRIENDSHIP_LEVEL_5, friendshipLevel5Date } from "@/lib/friendship";

/**
 * "Add someone today and you can reach friendship level 5 as soon as Jan 21,
 * 2027." Worked out in the browser from the player's own calendar. "As soon
 * as" because the game's day boundary and the friend's time zone can shift
 * it by a day.
 */
export function FriendshipLevel5() {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    setDate(friendshipLevel5Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
  }, []);
  if (!date) return null;
  return (
    <p className="text-sm text-slate-600 dark:text-slate-300">
      🤝 Add someone today and you can reach friendship level 5 as soon as <strong>{date}</strong> ({DAYS_TO_FRIENDSHIP_LEVEL_5}{" "}
      days).
    </p>
  );
}
