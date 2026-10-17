import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn(), cache: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: db.client }));
vi.mock("next/cache", () => ({ unstable_cache: db.cache }));
vi.mock("./supabase/env", () => ({ supabaseEnv: () => ({ url: "https://dev.example", key: "public-key" }) }));
import { loadPublicCommunityStats } from "./communityStats";

beforeEach(() => {
  vi.clearAllMocks();
  db.client.mockReturnValue({ rpc: db.rpc });
  db.cache.mockImplementation((fn) => fn);
});
describe("anonymous community cache", () => {
  it("uses only the public function and a separate five-minute cache without a session", async () => {
    db.rpc.mockResolvedValue({ data: [
      { line_id: "enough", wants: 1, dont_wants: 0, tops: 1, seen: 10, voters: 12 },
      { line_id: "early", wants: null, dont_wants: null, tops: null, seen: null, voters: null },
      { line_id: "defensive", wants: 9, dont_wants: 0, tops: 9, seen: 9, voters: 12 },
    ], error: null });
    expect(await loadPublicCommunityStats()).toEqual({ votes: { enough: { wants: 1, dontWants: 0, tops: 1, seen: 10 } }, voters: 12 });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("get_public_line_stats");
    expect(db.client).toHaveBeenCalledWith("https://dev.example", "public-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    expect(db.cache).toHaveBeenCalledWith(expect.any(Function), ["public-community-stats-v1", "https://dev.example"], { revalidate: 300 });
  });
  it("fails instead of falling back to unrestricted totals", async () => {
    db.rpc.mockResolvedValue({ data: null, error: new Error("unavailable") });
    await expect(loadPublicCommunityStats()).rejects.toThrow("unavailable");
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});
