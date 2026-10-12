import linesData from "@/data/candy-lines.json";
import islandsData from "@/data/islands.json";

export type Choice = "want" | "undecided" | "dont_want";

/** Display order of the three buckets. */
export const CHOICES: Choice[] = ["want", "undecided", "dont_want"];

export const CHOICE_LABEL: Record<Choice, string> = {
  want: "Want",
  undecided: "Undecided",
  dont_want: "Don't want",
};

export interface LineMember {
  name: string;
  dex: number;
  sprite: number;
}

/** One candy line: an evolution family whose forms all share one candy. */
export interface CandyLine {
  id: string;
  name: string;
  dex: number;
  type: string;
  addedAt: string;
  members: LineMember[];
}

export interface Island {
  id: string;
  name: string;
  /** Candy line ids that spawn on this island. */
  lines: string[];
}

export const LINES: CandyLine[] = linesData;
export const LINES_BY_ID = new Map(LINES.map((line) => [line.id, line]));
export const ISLANDS: Island[] = islandsData;

export function isChoice(value: unknown): value is Choice {
  return typeof value === "string" && (CHOICES as string[]).includes(value);
}

export function spriteUrl(sprite: number): string {
  return `/sprites/${sprite}.webp`;
}

/** Sprite of the species the candy is named after (Pikachu, not Pichu). */
export function lineSpriteUrl(line: CandyLine): string {
  const namesake = line.members.find((member) => member.dex === line.dex) ?? line.members[0];
  return spriteUrl(namesake.sprite);
}

/** Resolves line ids to lines in dex order, dropping ids no longer in the data. */
export function linesFromIds(ids: Iterable<string>): CandyLine[] {
  const out: CandyLine[] = [];
  for (const id of ids) {
    const line = LINES_BY_ID.get(id);
    if (line) out.push(line);
  }
  return out.sort((a, b) => a.dex - b.dex);
}
