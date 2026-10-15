import { describe, expect, it } from "vitest";
import { LINES } from "./lines";
import { votesCsv, votesText } from "./voteExport";

const [a, b, c] = LINES;

describe("vote export", () => {
  it("text lists the Top 3, then want, neutral and don't-want lines", () => {
    const text = votesText({ [a.id]: "want", [b.id]: "dont_want" }, [a.id]);
    expect(text).toContain(`★ Top 1: ${a.name}`);
    expect(text).toContain(`Want (1): ${a.name}`);
    expect(text).toContain(`Don't Want (1): ${b.name}`);
    expect(text).toMatch(new RegExp(`Neutral \\(${LINES.length - 2}\\): ${c.name}`));
  });
  it("csv has a row per line, unvoted counting as Neutral", () => {
    const rows = votesCsv({ [a.id]: "want" }, [a.id]).trim().split("\n");
    expect(rows).toHaveLength(LINES.length + 1);
    expect(rows[1]).toBe(`${a.name},${a.dex},Want,yes`);
    expect(rows[2]).toBe(`${b.name},${b.dex},Neutral,`);
  });
});
