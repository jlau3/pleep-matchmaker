import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ISLANDS, LINES, LINES_BY_ID, SLEEP_TYPES, lineHasSleepType, lineSpriteUrl, linesFromIds, recentLines, sleepTypeMember } from "./lines";

describe("candy line data", () => {
  it("has unique ids and at least one member per line", () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    for (const line of LINES) expect(line.members.length).toBeGreaterThan(0);
  });
  it("folds forms into their base line", () => {
    const pikachu = LINES_BY_ID.get("pikachu")!.members.map((m) => m.name);
    // Event costumes get their own icon, after the regular members.
    expect(pikachu).toEqual(["Pichu", "Pikachu", "Raichu", "Holiday Pikachu", "Halloween Pikachu", "Captain Pikachu"]);
    expect(LINES_BY_ID.get("eevee")!.members.map((m) => m.name)).toEqual(
      expect.arrayContaining(["Halloween Eevee", "Holiday Eevee"]),
    );
    // Sizes still fold into one icon.
    expect(LINES_BY_ID.get("pumpkaboo")!.members.map((m) => m.name)).toEqual(["Pumpkaboo", "Gourgeist"]);
    expect(LINES_BY_ID.has("toxtricity")).toBe(false);
    expect(LINES_BY_ID.get("wooper")!.members.map((m) => m.name)).toContain("Clodsire");
  });
});

describe("sleep types", () => {
  it("gives every member one of the three", () => {
    for (const line of LINES)
      for (const member of line.members) expect(SLEEP_TYPES, `${line.id}: ${member.name}`).toContain(member.sleepType);
  });
  it("matches a line on any of its forms", () => {
    const pikachu = LINES_BY_ID.get("pikachu")!;
    expect(lineHasSleepType(pikachu, "slumbering")).toBe(true); // Pichu
    expect(lineHasSleepType(pikachu, "snoozing")).toBe(true);
    expect(lineHasSleepType(pikachu, "dozing")).toBe(false);
  });

  it("only counts forms that spawn on the island", () => {
    const eevee = LINES_BY_ID.get("eevee")!;
    const island = (id: string) => ISLANDS.find((i) => i.id === id)!;
    // Taupe Hollow has Flareon and Umbreon, so no Slumbering (Vaporeon, Glaceon) there.
    expect(lineHasSleepType(eevee, "slumbering", island("taupe-hollow"))).toBe(false);
    expect(sleepTypeMember(eevee, "dozing", island("taupe-hollow"))?.name).toBe("Umbreon");
    expect(sleepTypeMember(eevee, "slumbering", island("snowdrop-tundra"))?.name).toBe("Glaceon");
    // A line that isn't on the island matches nothing there.
    expect(lineHasSleepType(eevee, "snoozing", island("snowdrop-tundra"))).toBe(false);
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
  it("lists spawning forms for exactly its lines, by member name", () => {
    for (const island of ISLANDS) {
      expect(Object.keys(island.spawns).sort(), island.id).toEqual([...island.lines].sort());
      for (const [lineId, names] of Object.entries(island.spawns)) {
        const members = LINES_BY_ID.get(lineId)!.members.map((m) => m.name);
        expect(names.length, `${island.id}: ${lineId}`).toBeGreaterThan(0);
        for (const name of names) expect(members, `${island.id}: ${lineId}`).toContain(name);
      }
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

describe("sprites", () => {
  it("has a file for every member's icon, event costumes included", () => {
    const dir = path.resolve(__dirname, "../../public/sprites");
    for (const line of LINES_BY_ID.values()) {
      for (const m of line.members) expect(existsSync(path.join(dir, `${m.sprite}.webp`)), `${m.name}: ${m.sprite}`).toBe(true);
    }
  });

  it("names the line after its regular namesake, not a costume", () => {
    expect(lineSpriteUrl(LINES_BY_ID.get("pikachu")!)).toBe("/sprites/25.webp");
    expect(lineSpriteUrl(LINES_BY_ID.get("eevee")!)).toBe("/sprites/133.webp");
  });
});
