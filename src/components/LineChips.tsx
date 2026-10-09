import { type CandyLine, lineSpriteUrl } from "@/lib/lines";

/** Compact sprite + name chips; optional count badge per line. */
export function LineChips({ lines, counts }: { lines: CandyLine[]; counts?: Map<string, number> }) {
  if (lines.length === 0) return <p className="text-sm text-slate-500">None</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {lines.map((line) => (
        <li
          key={line.id}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-0.5 pr-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <img src={lineSpriteUrl(line)} alt="" loading="lazy" className="h-7 w-7 object-contain" />
          {line.name}
          {counts && <span className="ml-1 font-semibold text-slate-500">{counts.get(line.id) ?? 0}</span>}
        </li>
      ))}
    </ul>
  );
}
