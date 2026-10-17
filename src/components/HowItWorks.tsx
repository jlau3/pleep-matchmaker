/** Visitor overview, opened deliberately from the Poké Ball. Page-specific ? help stays separate. */
export function HowItWorks() {
  return <div className="space-y-5 text-sm leading-relaxed">
    <p>Pleep Matchmaker helps Pokémon Sleep friends choose candy to send and find players with compatible candy preferences.</p>
    <section>
      <h3 className="mb-1 font-extrabold">Explore Without Signing In</h3>
      <p className="text-slate-600 dark:text-slate-300">Browse the Global Tier List, filter by island and sleep type, compare ranking styles, and export an image to share. Guides are open to everyone too.</p>
    </section>
    <section>
      <h3 className="mb-2 font-extrabold">Make It Personal</h3>
      <ul className="list-disc space-y-3 pl-5 text-slate-600 dark:text-slate-300">
        <li><b className="text-ink dark:text-white">Set Up Your Profile.</b> Add your in-game name, friend code, and Pokémon Sleep icon so friends can recognize you. Choose who can find you.</li>
        <li><b className="text-ink dark:text-white">Save Your Candy Votes.</b> Choose Want, Neutral, or Don&apos;t Want. Every change saves automatically. Your Top 3 Spotlight highlights the candy you most want friends to send, separately from tier scores.</li>
        <li><b className="text-ink dark:text-white">Connect With Friends.</b> Find your existing Pokémon Sleep friends or browse new players by estimated candy fit. Filters help narrow the list. Send a request here and add each other in Pokémon Sleep too.</li>
        <li><b className="text-ink dark:text-white">See What Your Friends Want.</b> Once they accept and vote, switch the Tier List to My Friends to help choose your research photo. Candy-fit numbers are estimates; Pleep doesn&apos;t see what anyone actually sends.</li>
      </ul>
    </section>
    <p className="text-xs text-slate-500">The ? button in the navbar explains the page you&apos;re on.</p>
  </div>;
}
