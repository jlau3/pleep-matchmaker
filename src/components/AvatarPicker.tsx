"use client";

import { useMemo, useState } from "react";
import { AVATAR_NAMES, AVATAR_VARIANTS, AVATARS, avatarLabel, avatarSrc, parseAvatar, type AvatarVariant } from "@/lib/avatars";

/**
 * In-game icon picker for the profile form: a searchable grid of Pokémon and
 * one variant (Normal, Happy, Shiny, Happy shiny). Submits as game_avatar
 * ("pikachu:happy"), or empty for the Discord picture.
 */
export function AvatarPicker({ initial, discordAvatar }: { initial: string | null; discordAvatar: string | null }) {
  const start = parseAvatar(initial);
  const [name, setName] = useState<string | null>(start?.[0] ?? null);
  const [variant, setVariant] = useState<AvatarVariant>(start?.[1] ?? "normal");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase().replace(/\s+/g, "_");
    return f ? AVATAR_NAMES.filter((n) => n.includes(f)) : AVATAR_NAMES;
  }, [filter]);
  const variants = name ? AVATARS[name] : [];
  const current = name && variants.includes(variant) ? variant : "normal";
  const value = name ? `${name}:${current}` : "";

  return (
    <div className="space-y-2">
      <input type="hidden" name="game_avatar" value={value} />
      <span className="block text-sm font-medium">Profile icon</span>
      <div className="flex items-center gap-3">
        {name ? (
          <img src={avatarSrc(name, current)} alt="" className="h-14 w-14 rounded-full bg-sky object-contain dark:bg-night-deep" />
        ) : discordAvatar ? (
          <img src={discordAvatar} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <span className="block h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700" />
        )}
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{name ? avatarLabel(name) : discordAvatar ? "Discord picture" : "No icon"}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen(!open)} className="rounded-full border border-slate-300 px-3 py-0.5 text-xs font-semibold dark:border-slate-600">
              {open ? "Done" : name ? "Change" : "Pick your in-game icon"}
            </button>
            {name && (
              <button type="button" onClick={() => setName(null)} className="text-xs text-slate-500 underline">
                Use {discordAvatar ? "Discord picture" : "no icon"}
              </button>
            )}
          </div>
        </div>
      </div>
      {name && (
        <div role="radiogroup" aria-label="Icon style" className="flex flex-wrap gap-2">
          {AVATAR_VARIANTS.filter(([v]) => variants.includes(v)).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={current === v}
              onClick={() => setVariant(v)}
              className={`rounded-full border px-3 py-0.5 text-xs ${
                current === v ? "pill-active border-transparent" : "border-slate-300 dark:border-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Use the same icon you have in Pokémon Sleep. IGNs aren&apos;t unique, so a matching icon helps friends tell it&apos;s
        really you.
      </p>
      {open && (
        <div className="space-y-2 rounded-2xl border border-slate-200 p-2 dark:border-slate-700">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search Pokémon"
            aria-label="Search Pokémon"
            className="w-full field"
          />
          <div className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
            {shown.map((n) => (
              <button
                key={n}
                type="button"
                title={avatarLabel(n)}
                aria-label={avatarLabel(n)}
                aria-pressed={n === name}
                onClick={() => setName(n)}
                className={`rounded-xl p-0.5 ${n === name ? "bg-sun/60 ring-2 ring-sun-deep" : "hover:bg-sky dark:hover:bg-night-deep"}`}
              >
                <img src={avatarSrc(n, "normal")} alt="" loading="lazy" className="aspect-square w-full" />
              </button>
            ))}
            {shown.length === 0 && <p className="col-span-full p-2 text-center text-xs text-slate-500">No match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
