import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withExtras } from "./extras";

describe("player card context", () => {
  it("loads context beyond the first 200 players without losing the original order", async () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({ user_id: `player-${i}`, match_pct: i }));
    const rpc = vi.fn(async (_name: string, { ids }: { ids: string[] }) => ({
      data: ids.map((user_id) => ({ user_id, you_source: "Everyone estimate", they_source: "Friends + Everyone", they_voted: null })), error: null,
    }));
    const actual = await withExtras({ rpc } as unknown as SupabaseClient, rows);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(actual.map((row) => row.user_id)).toEqual(rows.map((row) => row.user_id));
    expect(actual[204]).toMatchObject({ match_pct: 204, you_source: "Everyone estimate", they_source: "Friends + Everyone", they_voted: null });
  });
  it("retains scores if an extras batch fails and still adds context from successful batches", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ user_id: `${i}`, match_pct: 42 }));
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { message: "unavailable" } })
      .mockResolvedValueOnce({ data: [{ user_id: "200", you_source: "Everyone estimate" }], error: null });
    const actual = await withExtras({ rpc } as unknown as SupabaseClient, rows);
    expect(actual[0]).toEqual(rows[0]);
    expect(actual[200]).toMatchObject({ match_pct: 42, you_source: "Everyone estimate" });
  });
});
