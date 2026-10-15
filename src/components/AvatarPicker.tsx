"use client";

import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AVATAR_NAMES, AVATAR_VARIANTS, AVATARS, avatarLabel, avatarSrc, DEFAULT_AVATAR, parseAvatar, type AvatarVariant } from "@/lib/avatars";

/**
 * In-game icon picker for the profile form. Tapping your picture opens a
 * popup: the Pokémon grid scrolls on its own, and the style pills and Save
 * stay pinned below it. Saving submits the whole profile form with
 * game_avatar ("pikachu:happy"), or empty for the Discord picture.
 */
export function AvatarPicker({ initial, discordAvatar, requiredForSetup = false }: { initial: string | null; discordAvatar: string | null; requiredForSetup?: boolean }) {
  const start = parseAvatar(initial);
  // Saved value (the hidden input) and the draft being picked in the popup.
  const [saved, setSaved] = useState<string>(start ? `${start[0]}:${start[1]}` : "");
  const [name, setName] = useState<string | null>(start?.[0] ?? null);
  const [variant, setVariant] = useState<AvatarVariant>(start?.[1] ?? "normal");
  const [filter, setFilter] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase().replace(/\s+/g, "_");
    return f ? AVATAR_NAMES.filter((n) => n.includes(f)) : AVATAR_NAMES;
  }, [filter]);
  const variants = name ? AVATARS[name] : [];
  const current = name && variants.includes(variant) ? variant : "normal";
  const savedParsed = parseAvatar(saved);

  function openPicker() {
    // Start from what's saved, so Cancel then reopen doesn't keep a stray pick.
    setName(savedParsed?.[0] ?? null);
    setVariant(savedParsed?.[1] ?? "normal");
    setFilter("");
    dialog.current?.showModal();
  }

  function save(value: string) {
    flushSync(() => setSaved(value));
    dialog.current?.close();
    hidden.current?.form?.requestSubmit();
  }

  const big = "h-20 w-20 shrink-0 rounded-full";
  return (
    <div className="space-y-1">
      <input ref={hidden} type="hidden" name="game_avatar" value={saved} />
      <span className="block text-sm font-semibold">Pokémon Sleep profile picture</span>
      {requiredForSetup && !savedParsed && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Choose a picture to complete this setup step.</p>}
      <button
        type="button"
        onClick={openPicker}
        aria-label={savedParsed ? "Change profile picture" : "Choose profile picture"}
        className="group flex w-full items-center gap-3 rounded-2xl border-2 border-sun bg-sun/10 p-3 text-left hover:bg-sun/20"
      >
        {savedParsed ? (
          <img src={avatarSrc(...savedParsed)} alt="" className={`${big} bg-sky object-contain dark:bg-night-deep`} />
        ) : discordAvatar ? (
          <img src={discordAvatar} alt="" className={big} />
        ) : (
          <img src={DEFAULT_AVATAR} alt="" className={`${big} bg-sky object-contain dark:bg-night-deep`} />
        )}
        <span className="min-w-0 text-sm">
          <span className="mb-2 block font-semibold">
            {savedParsed ? `${avatarLabel(savedParsed[0])}${savedParsed[1] === "normal" ? "" : ` (${AVATAR_VARIANTS.find(([v]) => v === savedParsed[1])?.[1]})`}` : discordAvatar ? "Currently using your Discord picture" : "No picture chosen yet"}
          </span>
          <span className="btn-primary inline-flex min-h-11 items-center px-4 py-2 text-sm">
            {savedParsed ? "Change picture" : "Choose picture"} →
          </span>
        </span>
      </button>
      <p className="text-xs text-slate-500">
        Choose the same Pokémon picture you use in Pokémon Sleep. IGNs aren&apos;t unique, so a matching picture helps friends tell it&apos;s
        really you.
      </p>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-labelledby="avatar-title"
        className="m-auto h-[85dvh] max-h-[640px] w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]"
      >
        {/* Header and footer stay put; only the grid scrolls. */}
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
            {name ? (
              <img src={avatarSrc(name, current)} alt="" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night-deep" />
            ) : discordAvatar ? (
              <img src={discordAvatar} alt="" className="h-14 w-14 shrink-0 rounded-full" />
            ) : (
              <img src={DEFAULT_AVATAR} alt="" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night-deep" />
            )}
            <div className="min-w-0 flex-1">
              <h2 id="avatar-title" className="font-bold">
                {name ? avatarLabel(name) : "Choose your profile picture"}
              </h2>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                // Enter would submit the profile form behind the popup.
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder="Search Pokémon"
                aria-label="Search Pokémon"
                className="field mt-1 w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="self-start rounded-full px-2 text-2xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
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
              {shown.length === 0 && <p className="col-span-full p-4 text-center text-sm text-slate-500">No match.</p>}
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-700">
            <div role="radiogroup" aria-label="Picture style" className="grid grid-cols-4 gap-1.5">
              {AVATAR_VARIANTS.map(([v, label]) => {
                const available = variants.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={current === v}
                    disabled={!available}
                    title={name && !available ? `${avatarLabel(name)} has no ${label.toLowerCase()} icon` : undefined}
                    onClick={() => setVariant(v)}
                    className={`rounded-full border px-1 py-1 text-xs disabled:opacity-40 sm:text-sm ${
                      name && current === v ? "pill-active border-transparent" : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => save("")} className="text-xs text-slate-500 underline">
                Use {discordAvatar ? "Discord picture" : "no icon"}
              </button>
              <button
                type="button"
                disabled={!name}
                onClick={() => name && save(`${name}:${current}`)}
                className="btn-primary px-5 py-2 disabled:opacity-50"
              >
                Use this picture
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
