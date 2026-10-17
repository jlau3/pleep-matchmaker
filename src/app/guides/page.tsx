import { GUIDE_SECTIONS, META_DISCORD_URL } from "@/content/guides";
import { activeMetaPost, type MetaPost, publishedMetaPosts } from "@/content/meta";
import { LINES_BY_ID, lineSpriteUrl } from "@/lib/lines";
import { HowItWorks } from "@/components/HowItWorks";

export const metadata = { title: "Guides · Pleep Matchmaker" };

// Rebuilt hourly so a new-Pokémon note appears (and moves to "Earlier") on its dates.
export const revalidate = 3600;

/** The current new-Pokémon note first (if any), then general candy advice, then earlier notes. */
export default function GuidesPage() {
  const active = activeMetaPost();
  const earlier = publishedMetaPosts().filter((post) => post.id !== active?.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Guides</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Getting started and tips on where your candy does the most good.</p>
      </div>

      <section id="getting-started" className="card scroll-mt-20 p-5">
        <h2 className="mb-3 text-xl font-extrabold">Getting Started</h2>
        <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">Save your candy wishlist, connect with Pokémon Sleep friends, and see which candy they want you to send.</p>
        <HowItWorks />
      </section>

      {active && <MetaNote post={active} highlight />}

      {GUIDE_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="card space-y-4 p-5">
          <h2 className="text-xl font-extrabold">{section.title}</h2>
          {section.intro && <div className="guide-body">{section.intro}</div>}
          <ul className="space-y-4">
            {section.tips.map((tip) => (
              <li key={tip.title}>
                <h3 className="mb-1 font-bold">{tip.title}</h3>
                <div className="guide-body">{tip.body}</div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="guide-body">
          <b>Want to dig deeper into the meta?</b> Come talk team building, sub skills and new releases with other players
          in the Pokémon Sleep Discord.
        </p>
        <a
          href={META_DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-[#5865F2] px-5 py-2 font-extrabold text-white shadow-[0_3px_0_#3c45a5] hover:brightness-105"
        >
          Join the Discord
        </a>
      </section>

      {earlier.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Earlier PokéMon Notes</h2>
          {earlier.map((post) => (
            <details key={post.id} className="card p-4">
              <summary className="font-semibold">{post.title}</summary>
              <div className="mt-3">
                <MetaNote post={post} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

function MetaNote({ post, highlight = false }: { post: MetaPost; highlight?: boolean }) {
  const line = post.lineId ? LINES_BY_ID.get(post.lineId) : undefined;
  const body = <div className="guide-body">{post.body}</div>;
  if (!highlight) return body;
  return (
    <article className="card border-2 border-dashed border-sun-deep/60 bg-[#fff3c9] p-5 dark:bg-night">
      <div className="mb-3 flex items-center gap-3">
        {line && <img src={lineSpriteUrl(line)} alt="" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night-deep" />}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sun-deep">New Pokémon</p>
          <h2 className="text-xl font-extrabold">{post.title}</h2>
        </div>
      </div>
      {body}
    </article>
  );
}
