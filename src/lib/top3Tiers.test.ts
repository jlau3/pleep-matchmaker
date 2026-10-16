import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTop3Tiers } from "./top3Tiers";

it("surfaces failed tier loads for filters instead of treating them as valid empty results", async () => {
  const error = { message: "database unavailable" };
  const db = { rpc: vi.fn().mockResolvedValue({ data: null, error }) } as unknown as SupabaseClient;
  await expect(loadTop3Tiers(db, ["player"], true)).rejects.toEqual(error);
  await expect(loadTop3Tiers(db, ["player"])).resolves.toEqual({});
});

it("preserves explicit F and partial tier maps so the filter can reject them", async () => {
  const db = { rpc: vi.fn().mockResolvedValue({ data: [
    { user_id: "a", line_id: "bulbasaur", tier: "S" },
    { user_id: "a", line_id: "chikorita", tier: "Avoid" },
    { user_id: "b", line_id: "bulbasaur", tier: "C" },
  ], error: null }) } as unknown as SupabaseClient;
  await expect(loadTop3Tiers(db, ["a", "b"], true)).resolves.toEqual({
    a: { bulbasaur: "S", chikorita: "Avoid" }, b: { bulbasaur: "C" },
  });
});
