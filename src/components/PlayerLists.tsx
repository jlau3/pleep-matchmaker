import { linesFromIds } from "@/lib/lines";
import { IslandGroups } from "./IslandGroups";

/** A player's wants (open) and don't-wants (collapsed), split by island. */
export function PlayerLists({ wants, dontWants, open = false }: { wants: string[]; dontWants: string[]; open?: boolean }) {
  return (
    <details className="mt-3" open={open}>
      <summary className="text-sm font-semibold">
        Wants {wants.length} · doesn&apos;t want {dontWants.length}
      </summary>
      <div className="mt-3 space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-want">Wants</h4>
          <IslandGroups lines={linesFromIds(wants)} />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-dont">Doesn&apos;t want</h4>
          <IslandGroups lines={linesFromIds(dontWants)} />
        </div>
      </div>
    </details>
  );
}
