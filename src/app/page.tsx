import { redirect } from "next/navigation";
import { HowItWorks } from "@/components/HowItWorks";
import { SignInOptions } from "@/components/SignInOptions";
import { safeNextPath } from "@/lib/nextPath";
import { loadOwnChoices } from "@/lib/data";
import { LINES, lineSpriteUrl } from "@/lib/lines";
import { getAuth } from "@/lib/supabase/server";

const SHOWCASE = ["pikachu", "eevee", "dratini", "larvitar", "bulbasaur", "charmander", "squirtle"];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string; code?: string; deleted?: string; next?: string }> }) {
  const { supabase, userId } = await getAuth();

  const params = await searchParams;
  // If the callback URL isn't in Supabase's redirect allow list, Supabase falls
  // back to the Site URL root, so finish the sign-in from here too.
  if (params.code) redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`);

  const next = safeNextPath(params.next);
  if (userId) {
    if (next) redirect(next);
    const choices = await loadOwnChoices(supabase, userId);
    redirect(Object.keys(choices).length < LINES.length ? "/vote" : "/tiers");
  }

  const signInError = params.error_description ?? params.error;
  const showcase = LINES.filter((line) => SHOWCASE.includes(line.id));

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6">
      <div className="card px-6 py-10 text-center">
        <div className="mb-6 flex justify-center -space-x-3">
          {showcase.map((line) => (
            <img key={line.id} src={lineSpriteUrl(line)} alt="" className="h-14 w-14 rounded-full bg-sky object-contain ring-4 ring-cream dark:ring-night" />
          ))}
        </div>
        <img src="/logo.png" alt="" className="mx-auto mb-2 h-16 w-16" />
        <h1 className="mb-3 text-3xl font-extrabold">Pleep Matchmaker</h1>
        <p className="mb-8 text-slate-600 dark:text-slate-300">
          Sort every Pokémon Sleep candy line into want, don't want or neutral. See what candy your friends want, and
          find new friends who want the same candy you do.
        </p>
        {signInError && (
          <p role="alert" className="mb-4 text-sm text-dont">
            Sign-in failed: {signInError.slice(0, 200)}
          </p>
        )}
        {params.deleted && <p className="mb-4 text-sm text-slate-500">Your account has been deleted.</p>}
        <SignInOptions next={next} />
      </div>
      <section className="card p-6">
        <h2 className="mb-4 text-xl font-extrabold">How it works</h2>
        <HowItWorks links={false} />
      </section>
    </div>
  );
}
