import { redirect } from "next/navigation";
import TiersPage from "./tiers/page";
import { safeNextPath } from "@/lib/nextPath";
import { getAuth } from "@/lib/supabase/server";
import { signInLanding } from "@/lib/signInLanding";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string; code?: string; deleted?: string; next?: string; pool?: string; island?: string; sleep?: string }> }) {
  const params = await searchParams;
  // Supabase can fall back to the Site URL if the callback isn't allow-listed.
  if (params.code) redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`);
  const { supabase, userId } = await getAuth();
  if (userId) redirect(await signInLanding(supabase, userId, safeNextPath(params.next)));
  return <>
    {params.deleted && <p className="mb-4 text-sm text-slate-500">Your account has been deleted.</p>}
    <TiersPage searchParams={Promise.resolve(params)} />
  </>;
}
