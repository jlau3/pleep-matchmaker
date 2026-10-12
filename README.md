# Pleep Matchmaker

Pokémon Sleep players vote on every candy line: **want**, **don't want** or **undecided**. Three tabs:

- **Tier list** (home): which candy to prioritize, ranked S/A/B/C/Avoid by your friends' net votes, with toggles for All Islands / By Island and My Friends / Everyone. A banner links to voting when there are unvoted candies.
- **Friends**: player search (exact Discord name, IGN or friend code) on both sub-tabs, carried over when you switch; *My Friends* lists your friends (up to 50) with your match % for each; *Find New* is matchmaking against players open to new friends, leaving out anyone you already added.
- **Profile**: *My Votes* (every candy in dex order, List or Grid view, with a ★ on each card to pick your Top 3 wants, pinned at the top) and *Settings* (IGN, friend code, visibility toggles, blocked players, sign out, delete account).

New players go straight to My votes after signing in, and land on the Tier list once everything is voted.

A **How it works** card explains the app on the sign-in page, opens on a new player's first visit to My Votes, and lives at `/about` (the **?** in the header).

Stack: Next.js 15 (App Router) + Supabase (Postgres, Discord OAuth) + Tailwind. Built to run on the Vercel and Supabase free tiers.

## How matching works

Per candy line, comparing your pick (A) with theirs (B):

| A \ B | Want | Don't want | Undecided |
|---|---|---|---|
| **Want** | +3 | −3 | 0 |
| **Don't want** | −3 | +1 | 0 |
| **Undecided** | 0 | 0 | skipped |

Only lines where at least one of you picked want or don't want count. Each counted line's best case is 3 if either side wants it, otherwise 1.

`match % = max(0, score) / sum of best cases`

Want vs undecided lowers the % through the denominator alone. Want vs don't want lowers it twice as hard.

**Top 3:** each player can star up to 3 of their wants. A line either player starred counts double: both want is +6, a clash is −6, and its best case doubles too, so the % stays between 0 and 100. `public.max_top()` and `public.top_multiplier()` hold the numbers.

A match is shown when it's **≥ 25%** with **≥ 3 lines you both want**, the other player is open to new friends, has room on their friend list (under 50), has a friend code set, and was seen in the last **4 months**. A full friend list hides a player from matches automatically, without changing their setting, until they remove someone. All of these knobs live in `public.match_config()` in the first migration.

My Friends shows the same % for each friend, without the 25% / 3-shared-wants cutoff, so you can see how well your current friends line up.

## Tier list rules

Net votes = wants minus don't-wants among the pool (your friends who have voted, or every player active in the last 4 months), with a Top 3 star counting double: a starred want is +2, a plain want +1. Your own votes don't count.

Tiers are relative. Lines with a positive net are ranked, and split by position:

| Tier | Which lines |
|---|---|
| S | top 15% of liked lines |
| A | next 20% |
| B | next 30% |
| C | the rest, plus net 0 (no votes or an even split) |
| Avoid | net negative |

Lines that tie on net always share a tier, placed by the tie's middle rank, so with few voters (lots of ties) the sizes stay close to the targets. Fixed % cutoffs crowded S and Avoid with a small, decisive player base (32 S and 43 Avoid out of 107 at about 10 players), and would keep drifting as the pool grows; position-based tiers give every pool a usable spread. The shares live in `TIER_SHARES` in `src/lib/tiers.ts`. Because tiers are relative, every card also shows its **net %** (wants minus don't-wants over the whole pool, stars not weighted) so you can see how strong the support behind a rank is. In By Island view the ranking is within each island.

Above S, the **Top 3** row repeats the 9 lines that show up most often in players' Top 3 (ties broken like the rest of the list). They stay in their regular tier too, so nothing shifts. Every card shows its star count.

Inside a tier, lines sort by net votes, then a rarity weight, then wants. The weight only breaks ties and never moves a line between tiers: legendary 0.4, mythical 0.3, pseudo-legendary 0.2, 16-pip rare spawns 0.1, everything else 0. `scripts/build_lines.py` derives it from each line's first stage (EXP curve and friendship points).

## Privacy

- Row level security: users read and write only their own rows.
- Other players' data only comes out of `security definer` functions (`get_matches`, `lookup_players`, `get_friends`, `get_line_stats`, `get_voter_count`), which apply blocks, staleness, `open_to_friends` and `allow_lookup`.
- Lookup is exact-match only, so the player list can't be scrolled or enumerated. It ignores letter case, extra spaces and Unicode width/accent encoding differences (`public.search_key`), but never matches part of a name. Players can turn lookup off in Profile, which also hides their picks from people who added them as a friend.
- Blocking hides both players from each other everywhere and removes any friend link.
- Deleting an account removes the auth user, which cascades to everything else.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier). Turn **Data API** on (the app talks to the database through it), and **automatic RLS** on. Leave **auto-expose new tables** off: the migrations grant exactly the access the app needs.
2. Apply the migrations in `supabase/migrations/` in order: paste each into the SQL editor, or use `supabase link` and `supabase db push` with the Supabase CLI.
3. Under **Project Settings → API**, copy the project URL and the anon key.

### 2. Discord OAuth

1. Create an application at the [Discord developer portal](https://discord.com/developers/applications).
2. Under **OAuth2**, add the redirect `https://<your-project>.supabase.co/auth/v1/callback`.
3. In Supabase, go to **Authentication → Sign In / Providers → Discord**, enable it, and paste in the Discord client ID and secret.
4. In Supabase, go to **Authentication → URL Configuration**. Set the Site URL to your production URL and add these redirect URLs: `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.

### 3. Run locally

```bash
cp .env.local.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev
```

### 4. Deploy to Vercel

Import the repo in Vercel and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `CRON_SECRET`. `vercel.json` schedules a daily ping to `/api/keepalive`, because Supabase pauses free projects after a week without database traffic.

## Pokémon data

`src/data/candy-lines.json` and `public/sprites/` are generated by `scripts/build_lines.py`:

- Roster from [nitoyon/pokesleep-tool](https://github.com/nitoyon/pokesleep-tool) (MIT).
- Sprites are the in-game Pokémon Sleep icons from Serebii (`scripts/build_icons.py`, run after `build_lines.py`), downscaled to 128px webp. Anything Serebii lacks keeps the PokeAPI official artwork that `build_lines.py` downloads.
- All forms (event costumes, regional variants, sizes) share candy with their base species, so a line is one evolution family. Regional forms get their own sprite inside the line.

When the game adds Pokémon, re-run it and commit the result:

```bash
pip install pillow
npm run data
```

New lines are saved as Undecided for every player the next time they open **My Votes**.

### Island spawns

`src/data/islands.json` is generated from Serebii's location pages by `scripts/build_islands.py`, which maps every listed species to its candy line. Re-run it after `build_lines.py` when the game adds Pokémon or islands:

```bash
python3 scripts/build_islands.py
```

The script fails loudly if a species can't be matched (add it to `ALIASES`) or a page layout changes. Spawns Serebii doesn't list (Mew and Darkrai everywhere, Turtwig and Chimchar on some islands) are added from `EXTRA_SPAWNS` in the script.

## Tests

```bash
npm test          # unit tests (vitest)
npm run typecheck
npm run test:db   # migrations + SQL tests against a throwaway local Postgres
```

`test:db` needs the Postgres server binaries (`initdb`, `pg_ctl`) and `psql`. It stubs the Supabase `auth` schema and default grants, so it runs without Docker or the Supabase CLI.
