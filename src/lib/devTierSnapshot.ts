import "server-only";
import { isDevTierSnapshotEnabled, parseTierSnapshot } from "./tierSnapshot";

export async function loadDevTierSnapshot() {
  if (!isDevTierSnapshotEnabled(process.env)) return null;
  // The fixture is loaded only behind the preview/local-development guard.
  const { default: snapshot } = await import("@/data/dev-tier-snapshot.json");
  return parseTierSnapshot(snapshot);
}
