import { linesFromIds } from "@/lib/lines";
import { LineChips } from "./LineChips";

/**
 * A player's Top 3 Spotlight (always shown), then wants and don't-wants in a dropdown.
 * Starred lines are listed under Top 3 Spotlight only, not repeated under Wants.
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
  /** Not friends yet (votes are friends-only): show nothing rather than empty lists. */
  hidden?: boolean;
}) {
  if (hidden) return null;
  const tops = new Set(topWants);
  const otherWants = wants.filter((id) => !tops.has(id));
  return (
    <div className="mt-3 space-y-3">
      {topWants.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-sun-deep">★ Top 3 Spotlight</h4>
          <LineChips lines={linesFromIds(topWants)} />
        </div>
      )}
      <details>
        <summary className="text-sm font-semibold">
          Want {otherWants.length} · Don&apos;t Want {dontWants.length}
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-want">Want</h4>
            <LineChips lines={linesFromIds(otherWants)} />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-dont">Don't Want</h4>
            <LineChips lines={linesFromIds(dontWants)} />
          </div>
        </div>
      </details>
    </div>
  );
}
