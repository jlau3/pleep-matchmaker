import { redirect } from "next/navigation";
import { signInWithDiscord } from "@/app/actions";
import { loadOwnChoices } from "@/lib/data";
import { LINES, lineSpriteUrl } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";

const SHOWCASE = ["pikachu", "eevee", "dratini", "larvitar", "bulbasaur", "charmander", "squirtle"];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const choices = await loadOwnChoices(supabase, user.id);
    redirect(Object.keys(choices).length < LINES.length ? "/pick" : "/friends");
  }

  const params = await searchParams;
  const showcase = LINES.filter((line) => SHOWCASE.includes(line.id));

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="mb-6 flex justify-center -space-x-3">
        {showcase.map((line) => (
          <img key={line.id} src={lineSpriteUrl(line)} alt="" className="h-14 w-14 object-contain" />
        ))}
      </div>
      <h1 className="mb-3 text-3xl font-bold">Pleep Matchmaker</h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Sort every Pokémon Sleep candy line into want, don't want or undecided. See what candy your friends want, and
        find new friends who want the same candy you do.
      </p>
      {params.error && <p className="mb-4 text-sm text-dont">Sign-in failed. Try again.</p>}
      {params.deleted && <p className="mb-4 text-sm text-slate-500">Your account has been deleted.</p>}
      <form action={signInWithDiscord}>
        <button type="submit" className="w-full rounded-xl bg-[#5865F2] px-6 py-3 text-lg font-semibold text-white hover:bg-[#4752c4]">
          Sign in with Discord
        </button>
      </form>
    </div>
  );
}
