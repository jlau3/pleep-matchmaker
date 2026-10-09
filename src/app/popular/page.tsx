import { IslandGroups } from "@/components/IslandGroups";
import { LINES_BY_ID, type CandyLine } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";
import type { LineStatRow } from "@/lib/types";

function ranked(stats: LineStatRow[], key: "wants" | "dont_wants"): { lines: CandyLine[]; counts: Map<string, number> } {
  const rows = stats.filter((row) => Number(row[key]) > 0 && LINES_BY_ID.has(row.line_id));
  rows.sort((a, b) => Number(b[key]) - Number(a[key]));
  return {
    lines: rows.map((row) => LINES_BY_ID.get(row.line_id)!),
    counts: new Map(rows.map((row) => [row.line_id, Number(row[key])])),
  };
}

export default async function PopularPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_line_stats");
  if (error) throw error;
  const stats = data as LineStatRow[];
  const wanted = ranked(stats, "wants");
  const unwanted = ranked(stats, "dont_wants");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Popular</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Votes from players active in the last 4 months.</p>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-want">Most wanted</h2>
        <IslandGroups lines={wanted.lines} counts={wanted.counts} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-dont">Least wanted</h2>
        <IslandGroups lines={unwanted.lines} counts={unwanted.counts} />
      </section>
    </div>
  );
}
