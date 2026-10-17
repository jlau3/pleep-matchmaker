"use client";

import { ISLANDS, SLEEP_TYPES, SLEEP_TYPE_LABEL, type SleepType } from "@/lib/lines";

const MAPPED_ISLANDS = ISLANDS.filter((island) => island.lines.length > 0);
/** Island art from Neroli's Lab (public/islands, Apache-2.0; see NOTICE there). Expert areas reuse the base art. */
const ISLAND_ART: Record<string, string> = {
  "greengrass-isle": "greengrass",
  "cyan-beach": "cyan",
  "taupe-hollow": "taupe",
  "snowdrop-tundra": "snowdrop",
  "lapis-lakeside": "lapis",
  "old-gold-power-plant": "powerplant",
  "amber-canyon": "amber",
};
/** Dot color per sleep type, after the in-game colors. */
const SLEEP_DOT: Record<SleepType, string> = {
  dozing: "bg-[#f2c94c]",
  snoozing: "bg-[#5aa9e6]",
  slumbering: "bg-[#8a6fd1]",
};
const islandArt = (id: string) => ISLAND_ART[id.replace(/-expert$/, "")];
/** Short label under the icon: "Greengrass", "Cyan EX", "Power Plant". */
const shortName = (name: string) =>
  name.replace(/^Old Gold /, "").replace(/ (Isle|Beach|Hollow|Tundra|Lakeside|Canyon)/, "").replace(" (Expert)", " EX");


/** Shared island art, sleep colors, and deselection behavior on Tier List and My Votes. */
export function CandyFilters({ islandId, sleepType, onIsland, onSleep, tour = false, headerAction, children }: {
  islandId: string | null;
  sleepType: SleepType | null;
  onIsland: (value: string | null) => void;
  onSleep: (value: SleepType | null) => void;
  tour?: boolean;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "pill-active border-transparent" : "pill-idle border-slate-300 dark:border-slate-700"}`;
  return <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Island</span>
        {headerAction}
      </div>
      {/* One tap picks an island; tapping it again (or another) goes back / switches. None picked: all islands. */}
      {MAPPED_ISLANDS.length > 0 && (
        <div data-tier-tour={tour ? "island" : undefined} role="group" aria-label="Island" className="grid grid-cols-5 gap-1 sm:grid-cols-9">
          {MAPPED_ISLANDS.map((island) => {
            const active = island.id === islandId;
            const art = islandArt(island.id);
            return (
              <button
                key={island.id}
                type="button"
                onClick={() => onIsland(active ? null : island.id)}
                aria-pressed={active}
                title={active ? `${island.name} (tap again for all islands)` : island.name}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl p-1 text-[11px] font-semibold leading-tight transition ${
                  active
                    ? "bg-sun/70 ring-2 ring-sun-deep dark:bg-sun/30"
                    : islandId
                      ? "pill-idle opacity-50 hover:opacity-100"
                      : "pill-idle"
                }`}
              >
                <span className="relative">
                  {art ? (
                    <img src={`/islands/${art}.webp`} alt="" className="h-11 w-11" />
                  ) : (
                    <span className="block h-11 w-11 rounded-full bg-sky dark:bg-night-deep" />
                  )}
                  {island.id.endsWith("-expert") && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-night px-1 text-[9px] font-black text-white dark:bg-sun dark:text-[#5b3e00]">
                      EX
                    </span>
                  )}
                </span>
                <span className="text-center">{shortName(island.name)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Same one-tap toggle as the islands: a line shows if any of its forms sleeps that way. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-tier-tour={tour ? "sleep" : undefined} role="group" aria-label="Sleep Type" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Sleep Type</span>
          {SLEEP_TYPES.map((type) => {
            const active = type === sleepType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onSleep(active ? null : type)}
                aria-pressed={active}
                title={active ? `${SLEEP_TYPE_LABEL[type]} (tap again for all sleep types)` : `Pokémon with a ${SLEEP_TYPE_LABEL[type]} form`}
                className={`flex items-center gap-1.5 ${pill(active)} ${sleepType && !active ? "opacity-50 hover:opacity-100" : ""}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${SLEEP_DOT[type]}`} aria-hidden />
                {SLEEP_TYPE_LABEL[type]}
              </button>
            );
          })}
        </div>
        {children}
      </div>
    </div>;
}
