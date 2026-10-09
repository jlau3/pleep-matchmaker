import { type CandyLine, groupByIsland } from "@/lib/lines";
import { LineChips } from "./LineChips";

export function IslandGroups({ lines, counts }: { lines: CandyLine[]; counts?: Map<string, number> }) {
  const groups = groupByIsland(lines);
  if (groups.length === 0) return <p className="text-sm text-slate-500">None</p>;
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.id}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</h4>
          <LineChips lines={group.items} counts={counts} />
        </section>
      ))}
    </div>
  );
}
