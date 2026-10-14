import linesData from "@/data/candy-lines.json";
import islandsData from "@/data/islands.json";

export type Choice = "want" | "undecided" | "dont_want";

/** Display order of the three buckets. */
export const CHOICES: Choice[] = ["want", "undecided", "dont_want"];

/** Mirrors public.max_top(): how many wants a player can star as their Top 3. */
export const MAX_TOP = 3;

export const CHOICE_LABEL: Record<Choice, string> = {
  want: "Want",
  undecided: "Neutral",
  dont_want: "Don't Want",
};

export type SleepType = "dozing" | "snoozing" | "slumbering";

export const SLEEP_TYPES: SleepType[] = ["dozing", "snoozing", "slumbering"];

export const SLEEP_TYPE_LABEL: Record<SleepType, string> = {
  dozing: "Dozing",
  snoozing: "Snoozing",
  slumbering: "Slumbering",
};

export interface LineMember {
  name: string;
  dex: number;
  /** PokeAPI id (a number), or an event costume like "25-holiday" (Holiday Pikachu). */
  sprite: number | string;
  sleepType: SleepType;
}

/** One candy line: an evolution family whose forms all share one candy. */
export interface CandyLine {
  id: string;
  name: string;
  dex: number;
  type: string;
  addedAt: string;
  /** Rarity tie-break: legendary 0.4, mythical 0.3, pseudo-legendary 0.2, 16-pip 0.1, else 0. */
  weight: number;
  members: LineMember[];
}

export interface Island {
  id: string;
  name: string;
  /** Candy line ids that spawn on this island. */
  lines: string[];
}

export const LINES: CandyLine[] = linesData as CandyLine[];
export const LINES_BY_ID = new Map(LINES.map((line) => [line.id, line]));
export const ISLANDS: Island[] = islandsData;

/** Lines released in the last `days` days get the new candy card on My Votes. */
export const NEW_LINE_DAYS = 14;

export function recentLines(now = new Date(), days = NEW_LINE_DAYS): CandyLine[] {
  const cutoff = now.getTime() - days * 24 * 3600 * 1000;
  return LINES.filter((line) => new Date(`${line.addedAt}T00:00:00Z`).getTime() >= cutoff);
}

export function isChoice(value: unknown): value is Choice {
  return typeof value === "string" && (CHOICES as string[]).includes(value);
}

export function spriteUrl(sprite: number | string): string {
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

/** Whether any form in the line sleeps this way (Pichu slumbers while Pikachu snoozes, so a line can match several). */
export function lineHasSleepType(line: CandyLine, sleepType: SleepType): boolean {
  return line.members.some((member) => member.sleepType === sleepType);
}

export function isSleepType(value: unknown): value is SleepType {
  return typeof value === "string" && (SLEEP_TYPES as string[]).includes(value);
}
