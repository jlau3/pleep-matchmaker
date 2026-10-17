import { expect, it } from "vitest";
import { friendTierPool } from "./friendTierPool";
import { buildTiers } from "./tiers";
import { LINES } from "./lines";

it("counts Neutral-only friends without counting unsaved or invisible lists", () => {
  const candy = LINES[0];
  const rows = Array.from({ length: 12 }, (_, i) => ({ user_id: String(i), visible: i !== 11,
    wants: i === 0 ? [candy.id] : [], dont_wants: [], top_wants: [] }));
  const pool = friendTierPool(rows, [...Array.from({ length: 10 }, (_, i) => String(i)), "11"]);
  expect(pool.voters).toBe(10);
  expect(pool.friendCount).toBe(12);
  const fixed = buildTiers(new Map(Object.entries(pool.votes)), pool.voters, [candy], "fixed");
  expect(fixed.get("C")?.[0].support).toBe(10);
  const consensus = buildTiers(new Map(Object.entries(pool.votes)), pool.voters, [candy], "consensus");
  expect(consensus.get("A")?.[0].consensusNote).toBe("Mostly Neutral");
});
