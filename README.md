# Pleep Matchmaker

Pokémon Sleep players vote on every candy line: **want**, **don't want** or **neutral**. Three tabs:

- **Tier list** (public home): opens Everyone without signing in, with island/sleep filters and PNG export. Guides is also public. My Friends, Friends, and Profile stay visible and open a contextual sign-in sheet when locked; Sign in stays at the top right outside the scrolling tabs. Everyone uses anonymous aggregate totals cached for five minutes. The database masks all counts, stars, and tiers below 10 active players with a saved entry for that candy, including Neutral-only players. Those candies appear as “Not enough votes yet” on the page and in exports. Exports include the readable site domain. Signed-in players can switch to their friends’ Tier List; a banner links to voting when there are unvoted candies.
- **Friends**: player search (exact Discord name, IGN or friend code) on both sub-tabs, carried over when you switch; *My Friends* lists your friends (up to 50), sortable by Best match, Best for you, Your Top 3, or Recently active. My Friends and Find New share the sort options and primary score calculation; Top 3 uses the same loaded tier data, with private friends last and equal friends retaining their existing order. Friendships are a handshake, like the game's: **Send friend request** (which also means sending one in Pokémon Sleep), and once they **Accept**, you're on each other's lists; requests to you show under **Friend requests** (with the sender's friend code) plus a banner on every other page, yours under **Sent requests** (a decline shows there until you clear it; unanswered requests lapse after 30 days), and two crossed requests count as accepted (`send_friend_request` / `accept_friend_request` in `20261019000000_friend_requests.sql`; players can't write `friends` directly); *Find New Friends* lists players open to new friends (`browse_players`), 20 a page, with **Good fits / Everyone** and sorting by **Best fit / Recently active / Most in common**; it leaves out your friends and anyone blocked, full, inactive or without a friend code. Each card sends a friend request (and shows their code to send one in Pokémon Sleep too), with the earliest date someone added today could reach friendship level 5 (`DAYS_TO_FRIENDSHIP_LEVEL_5` = 100 in `src/lib/friendship.ts`, player-reported). Search results show each player's fit with your friends, and Find New Friends has a **Share a friend post** card (Copy, plus Share on phones): a "looking for friends" message for Discord, Reddit or group chats with your friend code, Top 3 and a pointer to look you up here.
- **Profile**: *My Votes* (every candy in dex order, List or Grid view, with a ★ on each card to pick your Top 3 wants, pinned at the top) and *Settings* (IGN, friend code, visibility toggles, **Show my Discord name**, **Theme** (match device, light or dark; saved per device in the `pm_theme` cookie), blocked players, sign out, delete account).

New players go straight to My votes after signing in, and land on the Tier list once everything is voted.

The sign-in sheet explains what an account unlocks; public visitors can browse Everyone first. The **?** in the nav opens the full help any time (Esc, ×, "Got it" or a tap outside closes it). First-time sign-ins land on Profile with the guided setup enabled, including OAuth, Google’s sign-in button and email links; returning players land on the Tier List, or their explicit shared-link destination. For new players, a shared destination (including its search) survives Profile setup and is consumed only after the saved profile is checked, or setup is explicitly skipped. On first sign-in, players see a short welcome with **Set up my profile**, followed by a **Get set up** checklist under the nav with four automatic checks: Profile setup (in-game name, friend code, and picture together), candy choices, a friend/request, and the Tier List. Its bottom line shows “Step 1 of 4” progress. It shows a progress bar and highlights the next unfinished task. **Set up my profile** and the checklist’s Profile action open a spotlight walkthrough (`/profile?setup=profile`): the page dims around the actual name, friend-code, icon and privacy controls, with a card pointing to the current field. It starts at the first missing essential, saves before advancing, supports Back / Finish later / Esc, and can be reopened with **Show me what to fill in**. Typed values and privacy selections survive saves and failed saves. The tutorial positions its card around visible controls without centering the page, scrolling only as needed for an off-screen step. Checks follow saved player data; successful votes update the checklist immediately, and failed saves leave it unchecked. Opening the Tier List after the other three main tasks completes setup. **Hide for now** hides the card for the browser session; **Skip setup** dismisses it permanently. Failed completion/dismissal saves leave the card visible with a retry action. Welcome state uses `profiles.help_seen_version` and `HELP_VERSION`; setup uses `profiles.setup_done`, both cached per account in cookies. New-Pokémon announcements and the first-friend note wait until setup is done or skipped. My Votes opens **How to vote** automatically the first time, after any welcome dialog closes; its button reopens it later (`profiles.vote_guide_seen` tracks whether it has been opened). The separate introductory card is removed. **Show what others pick** starts on, remembers an explicit opt-out, and applies the same community-choice glow to new-Pokémon cards and the regular list/grid; fewer than 10 players having seen a candy still produces no glow. `/about` redirects home. Full help ends with **Invite friends**; the Tier List also shows a dismissible invite reminder (hidden for two weeks). Friends uses the share-post card without a duplicate invite reminder. Closing the share-post card leaves a small **Share a friend post** link that restores it expanded; dismissal is remembered per account in that browser, with no automatic reappearance. When lookup is off, only a compact **Share a friend post** disclosure appears; attempting to open it shows the explanation and a link to Profile’s Privacy setting. Sharing never changes that setting for the player. Find New does not repeatedly warn players who chose to stay out of other players’ suggestions; Profile explains that choice. Both friend lists keep definitions and missing-score guidance under **How match scores work**, with a missing score labelled “not enough votes yet” on hover.

Sign in with Discord, Google, or an emailed one-time link (no password). Only Discord shows a name to other players, and only while the player keeps **Show my Discord name** on (Profile → Settings; on by default when you first sign up with Discord, and a later login never changes your choice). Everyone else is known by IGN.

Stack: Next.js 15 (App Router) + Supabase (Postgres, Discord/Google OAuth, email links) + Tailwind. Built to run on the Vercel and Supabase free tiers.

## How matching works

The % on Find New Friends, search results and My Friends is **fit**: how well a player's wants line up with what **your friends** want, not with your own votes.

1. **Group demand.** For each line, count how many of your friends want it. Friends with a private list don't count. Each line's share is its demand relative to your friends' most-wanted line, so the top line is 1 and a line half as many friends want is 0.5.
2. **Fit.** `fit % = sum over their wants of share / (number of their wants + sum over their don't-wants of share)`.
   - **Top 3 stars don't count in fit** (or in the tier score). They're a personal "good to know" for friends who want to send someone their favorites, shown on each player's list.
   - 100% means everything they want is among your friends' most-wanted candy and they don't turn any of it down. A want none of your friends share counts 0.
   - Don't-wants count as much as wants (`public.dont_want_weight()` = 1): friends send each other candy, and getting candy you don't want annoys people at least as much as missing a want. A don't-want costs in proportion to how much your friends want that line, so turning down their top candy costs a full want and turning down candy nobody wants costs nothing.
   - Neutral lines don't count.

On My Friends, each friend is compared with the *rest* of your list. Until any friend has voted, your own wants stand in for the group, so new players still get suggestions.

Find New Friends shows players at **≥ 25% fit** with **≥ 3 wants your friends share**, who are open to new friends, have room on their list (under 50), have a friend code set, and were seen in the last **4 months**. Results list the wants they share with your friends and the candy your friends want that they don't, most-wanted first. The knobs live in `public.match_config()`.

Anywhere else, a fit under 25% shows as an amber **low fit** (`LOW_FIT_PCT` in `src/lib/fit.ts`, kept equal to Find New Friends's cutoff): most of what they want, your friends don't.

**Inactive reports.** Removing a friend asks whether they stopped playing. A "yes" hides them from your Find New Friends right away and, once 2 people have said so (`public.inactive_reports_to_hide()`), from everyone's. Reports only count while the player hasn't been back since, so returning clears them.

## Tier list rules

The tier list answers "which candy should I send my friends?". Getting candy you don't want annoys people as much as missing one you do, so it ranks by **net score**: wants minus don't-wants (`DONT_WANT_WEIGHT` = 1, the same weight fit uses). Top 3 stars don't change the score; they're the first tie-breaker. The pool is your friends who have voted, or every player active in the last 4 months. Your own votes don't count. Example with 50 players: 39 want + 11 neutral scores 39, 30 want + 20 neutral scores 30, and 39 want + 11 don't-want scores 28, below both.

Tiers are relative. Lines scoring above 0 are ranked and split by position:

| Tier | Which lines |
|---|---|
| S | top 15% |
| A | next 20% |
| B | next 30% |
| C | the rest, plus lines at exactly 0 (nobody voted, or a split room) |
| Avoid | below 0: more people don't want it than want it |

Lines that tie share a tier, placed by the tie's middle rank, so with few voters (lots of ties) the sizes stay close to the targets. Fixed % cutoffs crowded S and Avoid with a small, decisive player base, and would keep drifting as the pool grows. The shares live in `TIER_SHARES` in `src/lib/tiers.ts`. Every card shows the net score as a **rating out of 100**: `50 + 50 x net / voters`, so with 50 players 50 don't-wants is 0, a split room is 50 and 50 wants is 100. It's colored in five 20-point bands (red, orange, yellow, lime, green) with a gray "/100" and sits next to the want / neutral / don't-want counts. It's the same order as the net score, so it never changes the ranking. In By Island view the ranking is within each island.

Above S, set apart in a dashed gold frame because it isn't a tier, the **Top 3** row repeats the 9 lines that show up most often in players' Top 3, with **Show all** to expand to every starred line, including ones in Avoid so nobody's pick is left out (ties broken like the rest of the list). They stay in their regular tier too, so nothing shifts. Every card shows its star count.

Inside a tier, lines sort by score, then Top 3 stars, then rarity, then fewer don't-wants, then dex. Lines tied on score share a tier whatever their stars, so stars only order them. Rarity only breaks ties and never moves a line between tiers: legendary, mythical, pseudo-legendary and 16-pip lines all rank equally ahead of other lines. `scripts/build_lines.py` derives it from each line's first stage (EXP curve and friendship points).

## Privacy

- Row level security: users read and write only their own rows.
- Other players' data only comes out of `security definer` functions (`browse_players`, `lookup_players`, `get_friends`, `get_friend_requests`, `get_sent_requests`, `get_line_stats`, `get_voter_count`), which apply blocks, staleness, `open_to_friends` and `allow_lookup`.
- Lookup is exact-match only, so the player list can't be scrolled or enumerated. It ignores letter case, extra spaces and Unicode width/accent encoding differences (`public.search_key`), but never matches part of a name. Players can turn lookup off in Profile, which also hides their picks from people who added them as a friend.
- Search needs your own IGN: without one the search box points to Profile and `lookup_players` returns nothing (`20261021000300_search_needs_ign.sql`).
- Friend codes travel only with friend requests (`20261021000900_codes_on_requests.sql`): the player you ask sees yours so they can add you in Pokémon Sleep; nobody else does (not Find New, search by IGN, friends, or people you asked), and it's dropped once you're friends, as in the game. You always see your own, and someone who typed it in search sees it. Ticking **Already friends in Pokémon Sleep** next to Send friend request sends it without your code (`friend_requests.share_code`, `20261021001000_request_without_code.sql`); the card then says they're already friends in the game. Searching and sending or accepting requests need your own IGN and friend code (`20261021000700_identity_required.sql`).
- Friend requests introduce the sender: the player asked sees their IGN, icon, friend code and (with **Show my Discord name** on) Discord name and picture, and (with **Show my Reddit name** on) Reddit name (`20261021000400_requests_show_sender.sql`, `20261021000500_requests_show_reddit.sql`). Sent requests likewise show the Discord name and picture of who you asked (`20261021000600_sent_requests_show_discord.sql`). With no IGN or Discord name, cards fall back to u/reddit-name, and the picture to the Unown default.
- Reddit names: friends only, behind **Show my Reddit name to friends** (`profiles.show_reddit`, default on; `20261021000200_reddit_friends_only.sql`).
- Names: other players only ever see a Discord name and avatar when the player has **Show my Discord name** on; with it off they're shown and found by IGN and friend code only. Google and email sign-ins never copy a name, photo or email into the profile (`sync_profile_from_auth` only reads Discord metadata).
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

### 2b. Google sign-in

1. In [Google Cloud console](https://console.cloud.google.com/) create a project, then **APIs & Services → OAuth consent screen**: External, app name "Pleep Matchmaker", your support email, scopes `email`, `profile`, `openid` only. Publish it (no verification needed for those scopes).
2. **Credentials → Create credentials → OAuth client ID → Web application**. Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
3. In Supabase, **Authentication → Sign In / Providers → Google**: enable, paste the client ID and secret.

The same redirect URLs as Discord apply. A Google sign-in with the same verified email as an existing Discord account is linked to it automatically.

### 2c. Email sign-in links

1. **Authentication → Sign In / Providers → Email**: enable it. Password sign-up isn't offered in the app; it only sends one-time links.
2. **Custom SMTP (required for real use).** Supabase's built-in sender only allows a few emails an hour and is meant for testing. Under **Authentication → Emails → SMTP settings**, plug in a free sender. [Brevo](https://www.brevo.com/) works without owning a domain (verify a single sender address; 300 emails/day free). [Resend](https://resend.com/) is nicer if you have a domain to verify.
3. **Email templates.** Under **Authentication → Emails → Templates**, make the link in both **Magic Link** and **Confirm signup** point at the app, so it works even when opened in the mail app's browser:

   ```html
   <h2>Sign in to Pleep Matchmaker</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
   <p>This link works once and expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```

   (The default templates still work, via `/auth/callback`, but only in the same browser that asked for the link.)

### 3. Run locally

```bash
cp .env.local.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev
```

### 3b. Dev database for previews

Vercel previews should use their own Supabase project, so new migrations are tried there before production.

1. Create a second Supabase project (free tier allows two), set up like step 1.
2. Load the schema: `scripts/bundle-migrations.sh > all.sql` and run it in the dev project's SQL editor. It also logs each migration as applied (`public.dev_applied_migrations`, dev only).
3. Fake players: `python3 scripts/dev_seed.py > seed.sql` and run it there. It refuses to run on a database with real players, and running it again replaces them. After signing in on a preview and setting your IGN in Profile, `select public.dev_befriend('YOUR_IGN', 15);` gives you friends, `select public.dev_requests_to('YOUR_IGN', 6);` incoming requests from a mix of senders and `select public.dev_requests_from('YOUR_IGN', 4);` sent ones. The players vary on purpose (sign-up type, missing IGN/code/icon, visibility, activity, voting style, stars, friend counts); the seed's last result lists the 20 named test fixtures.
4. Sign-in: in the Discord developer portal add the dev project's `https://<dev-project>.supabase.co/auth/v1/callback` redirect, then enable Discord in the dev project with the same client ID and secret. Under **Authentication → URL Configuration** set the Site URL to the branch preview URL and add `https://<project>-*-<team>.vercel.app/**` and `http://localhost:3000/**` as redirect URLs.
5. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the dev project's values for the **Preview** environment only (Production keeps the real ones), then redeploy the preview: `NEXT_PUBLIC_` values are built in.
6. Automatic dev migrations: add the dev project's **Session pooler** connection string (Connect → Session pooler, with the database password filled in) as the GitHub Actions secret `DEV_DATABASE_URL`. Every push to a branch other than main that adds a migration then applies it to the dev database (the **Dev database migrations** workflow, `scripts/dev-migrate.sh`). It refuses any database without the dev seed and the migration log, so a production connection string can't be migrated by mistake. Production migrations stay manual: run a PR's new files there after checking its preview.

The dev project pauses after a week without traffic (the keepalive cron only runs in production); restore it from the Supabase dashboard.

### 4. Deploy to Vercel

Import the repo in Vercel and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `CRON_SECRET`. Optional:

- `DISCORD_FEEDBACK_WEBHOOK_URL` (server-only): a webhook in your #feedback channel. The footer's **Send feedback** form posts there; signed-in players only, mentions disabled, one message a minute per browser.
- `NEXT_PUBLIC_DONATION_URL`: shows a small "Buy me a coffee or help with server costs" link in the footer.
- `KOFI_VERIFICATION_TOKEN` and `DISCORD_DONATIONS_WEBHOOK_URL` (server-only): donation pings in your #donations channel. In Ko-fi → Settings → More → API, set the webhook URL to `https://<your-site>/api/kofi` and copy the verification token. Private donations show as "Someone" without their message.

`vercel.json` schedules a daily ping to `/api/keepalive`, because Supabase pauses free projects after a week without database traffic.

## Pokémon data

`src/data/candy-lines.json` and `public/sprites/` are generated by `scripts/build_lines.py`:

- Roster from [nitoyon/pokesleep-tool](https://github.com/nitoyon/pokesleep-tool) (MIT).
- Sprites are the in-game Pokémon Sleep icons from Serebii (`scripts/build_icons.py`, run after `build_lines.py`), downscaled to 128px webp. Anything Serebii lacks keeps the PokeAPI official artwork that `build_lines.py` downloads.
- Profile icons (`public/avatars`, `src/data/avatars.json`) are the in-game icons from [Neroli's Lab](https://github.com/nerolis-lab/nerolis-lab) (Apache-2.0). `scripts/build_avatars.py` adds any Pokémon Neroli's has art for that we don't, as 96px webp in Pokédex order; the data refresh runs it too.
- All forms (event costumes, regional variants, sizes) share candy with their base species, so a line is one evolution family. Regional forms and event costumes (Holiday Pikachu's Santa hat, Halloween Eevee's witch hat, Captain Pikachu, Holiday Spheal) get their own icon inside the line; costumes are listed last, use the Serebii icon (`025-holiday.png` → `public/sprites/25-holiday.webp`), and new ones in the roster are picked up automatically.

When the game adds Pokémon, re-run it and commit the result:

```bash
pip install pillow
npm run data
```

New lines are saved as Neutral for every player the next time they open **My Votes**.

### Automatic updates

A scheduled GitHub Action keeps this current:

- **Data refresh** (`.github/workflows/data-refresh.yml`, every 6 hours): reruns `build_lines.py`, `build_icons.py --missing-only` (only new sprites and ones still without a Serebii icon, tracked in `scripts/icons-state.json`) and `build_islands.py`. If anything changed, `scripts/check_data.py` blocks the update when a line id would disappear (votes would orphan), a sprite is missing or an island names an unknown line. Then typecheck and tests run, and a `data/refresh` PR is opened or updated with a summary of new lines, members and spawns. Nothing ships until you merge it.

It pings Discord when the `DISCORD_WEBHOOK_URL` repository secret is set, headlined "New Pokémon" when nitoyon's roster adds lines or members (Server Settings → Integrations → Webhooks in Discord; GitHub repo → Settings → Secrets and variables → Actions). It also needs **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**. It can be run by hand from the Actions tab.

Lines released in the last 14 days get a **new candy card** at the top of My Votes, with spawn islands and what players have voted so far.

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

Find New supports account-persisted Hide controls in both layouts, with Undo and a Hidden players restore list. Hiding filters suggestions before sorting and pagination; it does not change blocks, friendships, requests, or search. The shared match-score guide opens once per account across My Friends and Find New, waits for other dialogs, and remains available from its button. Requires `20261023000000_hidden_suggestions.sql`.

The Add a friend setup step completes after a successful nonempty lookup (including no results), sending a request, or saving a Not here yet name. It stays complete while people have yet to accept; existing requests, friends, and saved names are backfilled by `20261023000100_friend_setup_started.sql`.

Setup opens `/tiers?pool=everyone`, overriding a previously saved My Friends view. Everyone is listed first. Tier List help opens once per signed-in account in each browser, remains available from its button, and is manual for public visitors. Tapping a selected Island or Sleep Type filter again clears it; exports preserve the selected pool and filters.

Tier List ranking styles: Standard (recommended) preserves the existing negative-total Avoid plus percentile ranking and stays the default on new visits. Fixed Scores is an explicit `?style=fixed` presentation choice; it uses the displayed 0–100 rating (S 90+, A 80+, B 67+, C below 67 with a nonnegative total). Negative totals remain Avoid. Styles do not change votes, match scores, or Top 3 sorting elsewhere. The style travels with filters in URLs and appears in export titles; it is deliberately not saved as a browser default.

Social identity now requires an IGN, friend code, and chosen Pokémon icon in both app controls and database search/browse/request functions (`20261024000100_require_profile_icon.sql`). The setup notice lives only on the two friend pages. Duplicate names are grouped using the same strong name key as search and prompt players to check the icon. `20261024000000_clear_unknown_sent_requests.sql` clears only sent requests whose recipients have no visible name; it preserves accounts, votes and friendships, and archives removed request rows in an RLS-enabled table with API access revoked. The dev workflow applies these migrations to the dev database only; production migrations remain separate.
