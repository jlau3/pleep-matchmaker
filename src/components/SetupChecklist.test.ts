import React from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ started: false, friends: 0, sent: 0, placeholders: 0 }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/app/actions", () => ({ markSetupDone: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getAuth: async () => ({ userId: "player", supabase: {
    from: (table: string) => {
      const result = { error: null, data: table === "profiles" ? {
        ign: "Sleepy", friend_code: "123456789012", game_avatar: "pikachu:normal",
        setup_done: false, friends_setup_started: state.started,
      } : null, count: table === "friends" ? state.friends : table === "friend_requests" ? state.sent : table === "friend_placeholders" ? state.placeholders : 1 };
      const query: Record<string, unknown> = {};
      for (const key of ["select", "eq", "neq", "gt"]) query[key] = () => query;
      query.maybeSingle = async () => result;
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve);
      return query;
    },
  } }),
}));
import { SetupChecklist } from "./SetupChecklist";
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { state.started = false; state.friends = state.sent = state.placeholders = 0; });
describe("friend setup does not wait for acceptance", () => {
  it("keeps Add a friend open before any attempt", async () => {
    const card = await SetupChecklist();
    expect(card?.props.steps.find((s: { id: string }) => s.id === "friends").done).toBe(false);
  });
  it.each(["started", "sent", "placeholders", "friends"] as const)("completes after %s without needing an accepted friend", async (source) => {
    if (source === "started") state.started = true; else state[source] = 1;
    const card = await SetupChecklist();
    expect(card?.props.steps.find((s: { id: string }) => s.id === "friends").done).toBe(true);
  });
});
