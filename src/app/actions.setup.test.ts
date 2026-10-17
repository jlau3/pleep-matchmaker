import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  profile: { ign: "Sleepy", friend_code: "123456789012", game_avatar: "pikachu:normal" },
  pending: "/friends?q=Sleepy%20Head&sort=match" as string | undefined,
  readError: null as object | null, writeError: null as object | null,
  deleted: vi.fn(), set: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.pending ? { value: state.pending } : undefined, delete: state.deleted, set: state.set }), headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireUser: async () => ({ user: { id: "player" }, supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: state.readError }) }) }),
      update: () => ({ eq: async () => ({ error: state.writeError }) }),
    }),
  } }),
}));
import { finishProfileSetup, markSetupDone } from "./actions";
beforeEach(() => {
  vi.clearAllMocks();state.profile = { ign: "Sleepy", friend_code: "123456789012", game_avatar: "pikachu:normal" };
  state.pending = "/friends?q=Sleepy%20Head&sort=match";state.readError = null;state.writeError = null;
});
describe("new-player shared destination", () => {
  it("continues to the saved link with its full search only after Profile is saved", async () => {
    expect(await finishProfileSetup()).toEqual({ next: state.pending });
    expect(state.deleted).toHaveBeenCalledExactlyOnceWith("pm_setup_next");
  });
  it.each(["ign", "friend_code", "game_avatar"] as const)("doesn't consume the link if saved %s is missing", async (key) => {
    state.profile[key] = "";
    expect((await finishProfileSetup()).error).toBeTruthy();
    expect(state.deleted).not.toHaveBeenCalled();
  });
  it("retains the link when checking the database fails", async () => {
    state.readError = {};
    expect((await finishProfileSetup()).error).toBeTruthy();expect(state.deleted).not.toHaveBeenCalled();
  });
  it("rejects unsafe destinations and defaults to candy choices", async () => {
    state.pending = "//another-site.example";
    expect(await finishProfileSetup("/\\another-site.example")).toEqual({ next: "/vote" });
  });
  it("can recover the destination from the Profile URL", async () => {
    state.pending = undefined;
    expect(await finishProfileSetup("/tiers?pool=friends&island=cyan-beach")).toEqual({ next: "/tiers?pool=friends&island=cyan-beach" });
  });
  it("honors a saved destination when setup is explicitly skipped", async () => {
    expect(await markSetupDone(false)).toEqual({ next: state.pending });
  });
  it("doesn't consume the destination when skipping setup fails to save", async () => {
    state.writeError = {};
    expect((await markSetupDone(false)).error).toBeTruthy();expect(state.deleted).not.toHaveBeenCalled();
  });
});
