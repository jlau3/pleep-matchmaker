import { linkProvider, unlinkProvider } from "@/app/actions";

const PROVIDERS = [
  { id: "discord", label: "Discord" },
  { id: "google", label: "Google" },
] as const;

/** Friendlier text for the errors linking can come back with (?error= on Settings). */
export function linkErrorText(error: string): string | null {
  if (error === "delete") return null; // Delete account has its own message.
  if (error === "unlink-last") return "Keep at least one way to sign in: link another method before removing this one.";
  if (/already|exists|linked to another/i.test(error))
    return "That account is already used by a different Pleep Matchmaker account. Sign in with it to use that account instead, or delete it there first and link it here.";
  if (/manual linking/i.test(error)) return "Linking accounts isn't switched on yet. Try again later.";
  return "Couldn't link that account. Try again.";
}

/**
 * Settings → Sign-in methods: which of Discord / Google this account can sign
 * in with, with Link and Unlink. Linking Discord also shows your Discord name
 * (taken from Discord itself, so it can't be faked); you can hide it above.
 */
export function SignInMethods({
  linked,
  discordName,
  notice,
}: {
  linked: string[];
  discordName: string | null;
  notice: { tone: "ok" | "error"; text: string } | null;
}) {
  return (
    <section>
      <h2 className="mb-1 font-semibold">Sign-in Methods</h2>
      <p className="mb-3 text-sm text-slate-500">
        Link Discord to show your Discord name to friends, or link both to sign in with either.
      </p>
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-3 rounded-lg px-3 py-2 text-sm ${
            notice.tone === "error"
              ? "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200"
              : "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200"
          }`}
        >
          {notice.text}
        </p>
      )}
      <ul className="space-y-2">
        {PROVIDERS.map((p) => {
          const isLinked = linked.includes(p.id);
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-night">
              <span>
                <strong>{p.label}</strong>{" "}
                {isLinked ? (
                  <span className="text-want">
                    linked{p.id === "discord" && discordName ? ` as @${discordName}` : ""}
                  </span>
                ) : (
                  <span className="text-slate-500">not linked</span>
                )}
              </span>
              <form action={isLinked ? unlinkProvider : linkProvider}>
                <input type="hidden" name="provider" value={p.id} />
                {isLinked ? (
                  linked.length > 1 && (
                    <button type="submit" className="rounded-full border border-slate-300 px-3 py-1 font-semibold dark:border-slate-600">
                      Unlink
                    </button>
                  )
                ) : (
                  <button type="submit" className="btn-primary px-4 py-1">
                    Link {p.label}
                  </button>
                )}
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
