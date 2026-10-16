import { describe, expect, it } from "vitest";
import { tierSections } from "@/components/TierExport";
import { LINES } from "./lines";
import { buildTiers, buildPublicTiers, parseTierStyle, tierDefinitions, type LineVotes, type TierId } from "./tiers";

const lines = LINES.slice(0, 12);
const tierOf = (tiers: ReturnType<typeof buildTiers>, id: string): TierId | undefined =>
  [...tiers].find(([tier, rows]) => tier !== "top" && rows.some((row) => row.line.id === id))?.[0];

describe("Tier List ranking styles", () => {
  it("defaults to the shared Standard rules, including unknown URL values", () => {
    for (const value of [undefined, null, "custom", "STANDARD", {}]) expect(parseTierStyle(value)).toBe("standard");
    expect(parseTierStyle("fixed")).toBe("fixed");
    const votes = new Map([[lines[0].id, { wants: 2, dontWants: 0 }]]);
    expect(buildTiers(votes, 10, lines)).toEqual(buildTiers(votes, 10, lines, "standard"));
  });

  it("uses fixed cutoffs, keeps Neutral in B, and preserves the negative-total Avoid rule", () => {
    const counts: [number, number, TierId][] = [
      [70, 0, "S"], // 90
      [67, 0, "A"], // 89
      [40, 0, "A"], // 80
      [37, 0, "B"], // 79
      [0, 0, "B"], // 67, all Neutral
      [0, 1, "C"], // 66
      [0, 25, "C"], // zero total, 50
      [0, 26, "avoid"],
    ];
    const votes = new Map(counts.map(([wants, dontWants], index) => [lines[index].id, { wants, dontWants }]));
    const tiers = buildTiers(votes, 100, lines.slice(0, counts.length), "fixed");
    counts.forEach(([, , expected], index) => expect(tierOf(tiers, lines[index].id)).toBe(expected));
  });

  it("keeps a candy in the same fixed tier when filtering or the electorate scales", () => {
    const votes = new Map(lines.map((line, i) => [line.id, { wants: i, dontWants: 0 }]));
    const full = buildTiers(votes, 20, lines, "fixed");
    const scaled = new Map([...votes].map(([id, vote]) => [id, { wants: vote.wants * 10, dontWants: 0 }]));
    for (const line of lines) {
      expect(tierOf(buildTiers(votes, 20, [line], "fixed"), line.id)).toBe(tierOf(full, line.id));
      expect(tierOf(buildTiers(scaled, 200, lines, "fixed"), line.id)).toBe(tierOf(full, line.id));
    }
  });

  it("keeps the Top 3 row and vote totals identical across styles", () => {
    const votes = new Map([[lines[0].id, { wants: 3, dontWants: 1, tops: 2 }], [lines[1].id, { wants: 1, dontWants: 8, tops: 1 }]]);
    const standard = buildTiers(votes, 10, lines);
    const fixed = buildTiers(votes, 10, lines, "fixed");
    expect(fixed.get("top")).toEqual(standard.get("top"));
    const flatten = (tiers: typeof fixed) => [...tiers].filter(([id]) => id !== "top").flatMap(([, rows]) => rows).sort((a, b) => a.line.id.localeCompare(b.line.id));
    expect(flatten(fixed)).toEqual(flatten(standard));
  });

  it.each(["standard", "fixed"] as const)("never ranks or exports low-count public candies in %s", (style) => {
    const votes = new Map<string, LineVotes>([[lines[0].id, { wants: 9, dontWants: 0, tops: 9, seen: 9 }], [lines[1].id, { wants: 10, dontWants: 0, seen: 10 }]]);
    const view = buildPublicTiers(votes, 10, lines.slice(0, 2), style);
    expect(view.unranked.map((r) => r.line.id)).toEqual([lines[0].id]);
    expect([...view.tiers.values()].flat().map((r) => r.line.id)).not.toContain(lines[0].id);
  });

  it("does not invent fixed rankings without voters", () => {
    const tiers = buildTiers(new Map(), 0, lines, "fixed");
    expect(tiers.get("C")).toHaveLength(lines.length);
    expect(tiers.get("S")).toHaveLength(0);
    expect(tierDefinitions("fixed").find((tier) => tier.id === "S")?.hint).toBe("90–100/100");
  });
});

describe("comparison ranking styles", () => {
  it("Percentile Only ranks negative totals instead of applying Standard's Avoid cutoff", () => {
    const votes = new Map(lines.slice(0, 4).map((line, i) => [line.id, { wants: 0, dontWants: 60 + i * 10 }]));
    expect(buildTiers(votes, 100, lines.slice(0, 4), "standard").get("avoid")).toHaveLength(4);
    const percentile = buildTiers(votes, 100, lines.slice(0, 4), "percentile");
    expect(percentile.get("avoid")).toHaveLength(0);
    expect(percentile.get("S")).toHaveLength(1);
  });
  it("Consensus separates disagreement from a mostly Neutral group with the same score", () => {
    const votes = new Map([
      [lines[0].id, { wants: 40, dontWants: 20 }], // same score as all Neutral
      [lines[1].id, { wants: 0, dontWants: 0 }],
      [lines[2].id, { wants: 50, dontWants: 50 }],
      [lines[3].id, { wants: 70, dontWants: 10 }],
      [lines[4].id, { wants: 10, dontWants: 70 }],
    ]);
    const consensus = buildTiers(votes, 100, lines.slice(0, 5), "consensus");
    expect(tierOf(consensus, lines[0].id)).toBe("A"); // mixed
    expect(tierOf(consensus, lines[1].id)).toBe("B"); // mostly Neutral
    expect(tierOf(consensus, lines[2].id)).toBe("C"); // divisive
    expect(tierOf(consensus, lines[3].id)).toBe("S"); // mostly Wanted
    expect(tierOf(consensus, lines[4].id)).toBe("avoid"); // mostly Unwanted
  });
  it("Natural Breaks finds clear gaps and keeps tied values together", () => {
    const wants = [0, 1, 20, 21, 40, 41, 80, 81, 81];
    const votes = new Map(wants.map((want, i) => [lines[i].id, { wants: want, dontWants: 0 }]));
    const natural = buildTiers(votes, 100, lines.slice(0, wants.length), "natural");
    expect(natural.get("S")!.map((r) => r.wants)).toEqual([81, 81, 80]);
    expect(natural.get("A")!.map((r) => r.wants)).toEqual([41, 40]);
    expect(natural.get("B")!.map((r) => r.wants)).toEqual([21, 20]);
    expect(natural.get("C")!.map((r) => r.wants)).toEqual([1, 0]);
  });
  it.each(["standard", "fixed", "percentile", "consensus", "natural"] as const)("%s never loses or duplicates a ranked candy or exposes low-count totals", (style) => {
    const votes = new Map(lines.map((line, i) => [line.id, { wants: i, dontWants: 0, tops: i === 0 ? 0 : 1, seen: i === 0 ? 9 : 20 }]));
    const publicView = buildPublicTiers(votes, 20, lines, style);
    const ranked = [...publicView.tiers].filter(([id]) => id !== "top").flatMap(([, rows]) => rows.map((r) => r.line.id));
    expect(new Set(ranked).size).toBe(lines.length - 1);
    expect(ranked).toHaveLength(lines.length - 1);
    expect(ranked).not.toContain(lines[0].id);
    expect(publicView.tiers.get("top")!.map((r) => r.line.id)).not.toContain(lines[0].id);
  });
});

it("exports Consensus category names instead of S–C labels", () => {
  const votes = new Map([[lines[0].id, { wants: 80, dontWants: 0 }]]);
  const tiers = buildTiers(votes, 100, [lines[0]], "consensus");
  const rows = tierSections([{ tiers }], "consensus")[0].rows;
  expect(rows.find((row) => row.items.length)?.label).toBe("Mostly\nWanted");
  expect(rows.some((row) => row.label === "S")).toBe(false);
});
