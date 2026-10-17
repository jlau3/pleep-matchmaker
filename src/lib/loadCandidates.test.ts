import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCandidates } from "./loadCandidates";
import { parseBrowse, matchesBrowseFilters, sortPlayers } from "./browse";

it("loads beyond 1,000 before applying activity/filter/sort rules", async () => {
  const rows = Array.from({ length: 1101 }, (_, i) => ({ user_id: String(i).padStart(8, "0"), good: true,
    list_voters: 1, last_seen_at: new Date(1700000000000 + i * 1000).toISOString(), you_utility: 1101 - i, is_new: i === 1100 }));
  const rpc = vi.fn(async (_: string, args: { after_id: string | null; batch_size: number }) => ({
    data: rows.filter((row) => !args.after_id || row.user_id > args.after_id).slice(0, args.batch_size), error: null,
  }));
  const all = await loadCandidates({ rpc } as unknown as SupabaseClient);
  expect(all).toHaveLength(1101);
  expect(rpc).toHaveBeenCalledTimes(3);
  expect(sortPlayers(all, "active")[0].user_id).toBe(rows[1100].user_id);
  expect(all.filter((row) => matchesBrowseFilters(row, parseBrowse({ joined: "new" })))).toHaveLength(1);
});

it("rejects a failed later batch instead of returning an incomplete All Players", async () => {
  const error = { message: "failed batch" };
  const rpc = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => ({ user_id: String(i).padStart(8, "0") })), error: null })
    .mockResolvedValueOnce({ data: null, error });
  await expect(loadCandidates({ rpc } as unknown as SupabaseClient)).rejects.toEqual(error);
});
