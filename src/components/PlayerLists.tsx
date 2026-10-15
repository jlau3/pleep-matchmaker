import { linesFromIds } from "@/lib/lines";
import { LineChips } from "./LineChips";

/**
 * A player's Top 3 (always shown), then wants and don't-wants in a dropdown.
 * Starred lines are listed under Top 3 only, not repeated under Wants.
 */
export function PlayerLists({
  wants,
  dontWants,
  topWants,
  hidden = false,
}: {
  wants: string[];
  dontWants: string[];
  topWants: string[];
  /** Not friends yet (votes are friends-only): say so instead of showing empty lists. */
  hidden?: boolean;
}) {
  if (hidden)
    return <p className="mt-3 text-sm text-slate-500">Their votes show once you&apos;re friends.</p>;
  const tops = new Set(topWants);
  const otherWants = wants.filter((id) => !tops.has(id));
  return (
    <div className="mt-3 space-y-3">
      {topWants.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-sun-deep">★ Top {topWants.length}</h4>
          <LineChips lines={linesFromIds(topWants)} />
        </div>
      )}
      <details>
        <summary className="text-sm font-semibold">
          Wants {otherWants.length} · Doesn&apos;t Want {dontWants.length}
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-want">Wants</h4>
            <LineChips lines={linesFromIds(otherWants)} />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-dont">Doesn&apos;t Want</h4>
            <LineChips lines={linesFromIds(dontWants)} />
          </div>
        </div>
      </details>
    </div>
  );
}
