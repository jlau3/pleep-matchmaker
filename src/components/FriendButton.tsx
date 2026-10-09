"use client";

import { useState, useTransition } from "react";
import { addFriend, removeFriend } from "@/app/actions";

export function FriendButton({ userId, isFriend }: { userId: string; isFriend: boolean }) {
  const [friend, setFriend] = useState(isFriend);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = friend ? await removeFriend(userId) : await addFriend(userId);
      if (result.error) setError(result.error);
      else setFriend(!friend);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={`rounded-lg px-3 py-1 text-sm font-semibold disabled:opacity-50 ${
          friend
            ? "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
            : "bg-want text-white"
        }`}
      >
        {friend ? "Remove friend" : "Add friend"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-dont">
          {error}
        </span>
      )}
    </span>
  );
}
