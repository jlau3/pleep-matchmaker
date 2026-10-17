"use client";

import { useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const OPTIONS: [Theme, string][] = [
  ["system", "Match device"],
  ["light", "Light"],
  ["dark", "Dark"],
];

/**
 * Light / dark / match device. Saved per device in a cookie, so the server
 * renders the right theme on the next page load without a flash; applied here
 * straight away by swapping the class on <html>.
 */
export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (next !== "system") root.classList.add(next);
    document.cookie =
      next === "system"
        ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
        : `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
      {OPTIONS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => choose(value)}
          className={`rounded-full border px-3 py-1 text-sm ${
            theme === value
              ? "border-transparent bg-night text-white dark:bg-sun dark:text-[#5b3e00]"
              : "pill-idle border-slate-300 dark:border-slate-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
