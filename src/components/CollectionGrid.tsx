"use client";

import { useMemo, useState } from "react";
import { CHOICE_LABEL, LINES, type Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

type Filter = "all" | Choice;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want", label: CHOICE_LABEL.want },
  { value: "dont_want", label: CHOICE_LABEL.dont_want },
  { value: "undecided", label: CHOICE_LABEL.undecided },
];

/** Searchable, filterable grid of every line with compact vote buttons. */
export function CollectionGrid({
  choices,
  onChoose,
}: {
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LINES.filter((line) => {
      const choice = choices[line.id];
      // A line with no vote counts as undecided, same as in matching and the tier list.
      if (filter !== "all" && (choice ?? "undecided") !== filter) return false;
      return !q || line.members.some((member) => member.name.toLowerCase().includes(q));
    });
  }, [choices, query, filter]);

  return (
    <div>
      <div className="mb-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Pokémon"
          className="w-full field"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                filter === f.value
                  ? "pill-active border-transparent"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((line) => (
          <LineCard key={line.id} line={line} choice={choices[line.id]} onChoose={(c) => onChoose(line.id, c)} compact />
        ))}
      </div>
      {visible.length === 0 && <p className="py-8 text-center text-slate-500">Nothing here.</p>}
    </div>
  );
}
