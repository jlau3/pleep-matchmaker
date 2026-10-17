import { AutoSignIn } from "@/components/SignInSheet";
import { safeNextPath } from "@/lib/nextPath";
import { signInReason } from "@/lib/signInSheet";

/** Middleware rewrites here without changing a shared link's address or search. */
export default async function SignInRequired({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const destination = safeNextPath((await searchParams).next) ?? "/tiers?pool=friends";
  return <section className="mx-auto max-w-md py-12 text-center"><h1 className="text-xl font-bold">{signInReason(destination)}</h1><p className="mt-3 text-sm text-slate-500">Your link is saved while you sign in.</p><AutoSignIn destination={destination} /></section>;
}
