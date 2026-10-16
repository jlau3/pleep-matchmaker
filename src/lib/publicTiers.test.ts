import { describe, expect, it } from "vitest";
import { LINES } from "./lines";
import { buildPublicTiers } from "./tiers";
import { RANKING_PENDING, tierSections } from "@/components/TierExport";

describe("public tiers and exports", () => {
  it("never ranks or stars lines seen by fewer than 50 players", () => {
    const [enough, early, absent] = LINES;
    const view = buildPublicTiers(new Map([
      [enough.id, { wants: 1, dontWants: 0, tops: 1, seen: 50 }],
      [early.id, { wants: 9, dontWants: 0, tops: 9, seen: 49 }],
    ]), 50, [enough, early, absent]);
    expect(Array.from(view.tiers.values()).flat().every((row) => row.line.id === enough.id)).toBe(true);
    expect(view.unranked.map((row) => row.line)).toEqual([early, absent]);
    expect(view.unranked[0].counts).toEqual({ wants: 9, dontWants: 0, neutral: 40, seen: 49 });
    expect(view.unranked[1].counts).toBeUndefined();
    const sections = tierSections([view]);
    expect(sections.at(-1)?.heading).toBe(RANKING_PENDING);
    expect(sections.at(-1)?.rows[0].items).toHaveLength(2);
    expect(sections.at(-1)?.rows[0].items.every((item) => !("tops" in item))).toBe(true);
  });
  it("keeps an entirely suppressed public pool exportable without any invented tiers", () => {
    const view = buildPublicTiers(new Map(), 0, LINES.slice(0, 2));
    expect(Array.from(view.tiers.values()).flat()).toEqual([]);
    expect(view.unranked).toHaveLength(2);
    expect(tierSections([view]).filter((section) => section.rows.some((row) => row.items.length))).toHaveLength(1);
  });
});
