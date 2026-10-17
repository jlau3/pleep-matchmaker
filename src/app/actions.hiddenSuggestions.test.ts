import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ error: null as { code?: string } | null, insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: db.revalidate }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireUser: async () => ({ user: { id: "viewer" }, supabase: { from: () => ({ insert: db.insert, delete: db.delete }) } }),
}));
import { hideSuggestedPlayer, restoreSuggestedPlayer } from "./actions";
beforeEach(() => {
  vi.clearAllMocks(); db.error = null;
  db.insert.mockImplementation(async () => ({ error: db.error }));
  db.eq.mockImplementation(() => ({ eq: async () => ({ error: db.error }) }));
  db.delete.mockReturnValue({ eq: db.eq });
});
describe("personal suggestion preferences", () => {
  it("saves under the authenticated account and refreshes suggestions", async () => {
    expect(await hideSuggestedPlayer("candidate")).toEqual({});
    expect(db.insert).toHaveBeenCalledWith({ user_id: "viewer", hidden_user_id: "candidate" });
    expect(db.revalidate).toHaveBeenCalledWith("/matches");
  });
  it("treats an already saved preference as success", async () => {
    db.error = { code: "23505" };
    expect(await hideSuggestedPlayer("candidate")).toEqual({});
  });
  it("does not claim success or refresh when the write fails", async () => {
    db.error = { code: "42501" };
    expect((await hideSuggestedPlayer("candidate")).error).toBeTruthy();
    expect(db.revalidate).not.toHaveBeenCalled();
  });
  it("never writes a self-hide", async () => {
    expect((await hideSuggestedPlayer("viewer")).error).toBeTruthy();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("scopes restoring to the current account", async () => {
    expect(await restoreSuggestedPlayer("candidate")).toEqual({});
    expect(db.eq).toHaveBeenCalledWith("user_id", "viewer");
    expect(db.revalidate).toHaveBeenCalledWith("/matches");
  });
});
