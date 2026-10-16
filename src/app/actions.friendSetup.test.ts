import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ error: null as object | null, rpc: vi.fn(), update: vi.fn(), eq: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: db.revalidate }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireUser: async () => ({ user: { id: "viewer" }, supabase: {
    rpc: db.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ign: "Sleepy", friend_code: "123456789012" } }) }) }),
      update: db.update,
    }),
  } }),
}));
import { lookupPlayers } from "./actions";
beforeEach(() => {
  vi.clearAllMocks(); db.error = null;
  db.rpc.mockImplementation(async () => ({ data: [], error: db.error }));
  db.eq.mockResolvedValue({ error: null }); db.update.mockReturnValue({ eq: db.eq });
});
describe("looking up friends completes the setup attempt", () => {
  it("counts an actual search even if the friend hasn't joined", async () => {
    expect(await lookupPlayers("Sleepy friend")).toEqual({ rows: [] });
    expect(db.update).toHaveBeenCalledWith({ friends_setup_started: true });
    expect(db.eq).toHaveBeenCalledWith("id", "viewer");
    expect(db.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("does not complete setup for an empty query", async () => {
    await lookupPlayers("   ");
    expect(db.rpc).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled();
  });
  it("does not complete setup when the search fails", async () => {
    db.error = {};
    expect((await lookupPlayers("Sleepy friend")).error).toBeTruthy();
    expect(db.update).not.toHaveBeenCalled();
  });
});
