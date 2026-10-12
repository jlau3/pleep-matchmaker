import { describe, expect, it } from "vitest";
import { ISLANDS, LINES, LINES_BY_ID, linesFromIds, recentLines } from "./lines";

describe("candy line data", () => {
  it("has unique ids and at least one member per line", () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    for (const line of LINES) expect(line.members.length).toBeGreaterThan(0);
  });
  it("folds forms into their base line", () => {
    const pikachu = LINES_BY_ID.get("pikachu")!.members.map((m) => m.name);
    expect(pikachu).toEqual(["Pichu", "Pikachu", "Raichu"]);
    expect(LINES_BY_ID.has("toxtricity")).toBe(false);
    expect(LINES_BY_ID.get("wooper")!.members.map((m) => m.name)).toContain("Clodsire");
  });
});

describe("linesFromIds", () => {
  it("sorts by dex and drops unknown ids", () => {
    expect(linesFromIds(["eevee", "nope", "bulbasaur"]).map((l) => l.id)).toEqual(["bulbasaur", "eevee"]);
  });
});

describe("island data", () => {
  it("only references known candy lines", () => {
    for (const island of ISLANDS) {
      for (const id of island.lines) expect(LINES_BY_ID.has(id), `${island.id}: ${id}`).toBe(true);
    }
  });
  it("has every island populated", () => {
    expect(ISLANDS.length).toBe(9);
    for (const island of ISLANDS) expect(island.lines.length).toBeGreaterThan(0);
  });
});

describe("recentLines", () => {
  it("returns lines released within the window", () => {
    const newest = [...LINES].sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0];
    const day = new Date(`${newest.addedAt}T00:00:00Z`);
    expect(recentLines(new Date(day.getTime() + 13 * 864e5)).map((l) => l.id)).toContain(newest.id);
    expect(recentLines(new Date(day.getTime() + 15 * 864e5)).map((l) => l.id)).not.toContain(newest.id);
  });
});
