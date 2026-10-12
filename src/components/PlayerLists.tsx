import { linesFromIds } from "@/lib/lines";
import { LineChips } from "./LineChips";

/** A player's wants and don't-wants, in dex order. */
export function PlayerLists({ wants, dontWants }: { wants: string[]; dontWants: string[] }) {
  return (
    <details className="mt-3">
      <summary className="text-sm font-semibold">
        Wants {wants.length} · Doesn&apos;t Want {dontWants.length}
      </summary>
      <div className="mt-3 space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-want">Wants</h4>
          <LineChips lines={linesFromIds(wants)} />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-dont">Doesn&apos;t Want</h4>
          <LineChips lines={linesFromIds(dontWants)} />
        </div>
      </div>
    </details>
  );
}
