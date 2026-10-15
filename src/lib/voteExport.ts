import { CHOICE_LABEL, type Choice, LINES } from "./lines";

/** Your votes as text to paste (Discord, notes): Top 3, then each choice with its lines in Pokédex order. */
export function votesText(choices: Record<string, Choice>, tops: Iterable<string>): string {
  const top = new Set(tops);
  const named = (choice: Choice) => LINES.filter((line) => (choices[line.id] ?? "undecided") === choice).map((line) => line.name);
  const topNames = LINES.filter((line) => top.has(line.id)).map((line) => line.name);
  const section = (choice: Choice) => {
    const names = named(choice);
    return `${CHOICE_LABEL[choice]} (${names.length}): ${names.length ? names.join(", ") : "none"}`;
  };
  return [
    "My Pokémon Sleep candy votes (Pleep Matchmaker)",
    ...(topNames.length ? [`★ Top ${topNames.length}: ${topNames.join(", ")}`] : []),
    section("want"),
    section("undecided"),
    section("dont_want"),
  ].join("\n");
}

/** One row per candy line: name, Pokédex number, your choice, and whether it's in your Top 3. */
export function votesCsv(choices: Record<string, Choice>, tops: Iterable<string>): string {
  const top = new Set(tops);
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
  const rows = LINES.map((line) =>
    [cell(line.name), String(line.dex), CHOICE_LABEL[choices[line.id] ?? "undecided"], top.has(line.id) ? "yes" : ""].join(","),
  );
  return ["Candy,Dex,Vote,Top 3", ...rows].join("\n") + "\n";
}
