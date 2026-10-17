# Expected candy fit trial: dev handoff

Work stays on `claude/pokemon-sleep-matchmaking-esw90a`. Production application is not authorized; the user will approve dev and hand it to the production agent.

## Contextual help and onboarding replay release

After the matching bundle, apply `supabase/migrations/20261026000700_replay_onboarding.sql` once alongside the contextual-help app release. This separately resets only `help_seen_version`, `setup_done`, `vote_guide_seen` and `match_guide_seen`. It preserves identities, privacy, availability, votes, Spotlight, friends and requests. Do not repeat the reset on subsequent releases. Dev uses its normal migration log; do not add this migration to the matching squash.

The app uses version 2 browser markers for the checklist, snooze, Profile dismissal and Tier List tour, so old dismissal cookies cannot suppress this replay. Existing sessions start at guided Profile on their next rendered visit, preserving the original destination; sign-ins use the same rule. Opening guided Profile records the legacy onboarding marker and refreshes the shared layout so subsequent navigation is not redirected again. Existing votes/friends remain checked only after their corresponding guides have opened. Completing or dismissing setup is still remembered normally.

The navbar ? now opens the current page's help: match scores on My Friends/Find New Friends, How to Vote, the Profile walkthrough or Tier List walkthrough. Other pages link to Getting Started in Guides. First-visit page guides remain, the automatic welcome is removed, and the sign-in sheet keeps a short What You Get list.

Follow the replay migration with `20261026000800_hidden_suggestion_names.sql`. It adds the authenticated owner-only restore-list RPC; closed, inactive or full players retain their IGN independently of current suggestions, while lookup-off non-friends and blocked players return no name. It returns no votes, contact fields or fit. Visiting the Tier List no longer finishes setup: the last tour step or an explicit Finish setup does. Tours wait for checklist hydration and track page-height changes so highlights stay aligned. The match guide uses the agreed short explanation with its calculation collapsed.

Regression matrix: check new, partial Profile, saved Profile/no votes, saved votes/no friends, fully prefilled, and previously completed accounts. A Tier List visit must not call setup completion. Got it on the final tour step completes only when the prior steps are done; Skip/Esc leaves setup unfinished, with Finish setup available for players who already saw the tour. Check highlights after checklist hydration and late banner changes on mobile and tall desktop windows. Run a prefilled Profile through every step without altering privacy radios/social toggles. Hidden restores must retain eligible-to-view IGNs outside browse_all, redact blocked/lookup-off identities, and never read another account's list.

Voting list auto-advance centers the next card below the measured navigation and vote toolbar, after rendering the selected vote. It tracks late setup/hint layout changes until the next manual interaction, respects reduced motion, and leaves re-votes and Grid stationary. Check first-save checklist changes, Neutral filters as voted cards leave the list, tall navigation, and cancellation by manual scrolling.

## Trial behavior

- Count friends' Wants, add the existing k=5 global prior, and normalize total demand into sending shares. Do not divide a friend's contribution across their Wants or weight Spotlight. Exclude the receiver from a sender's existing friends. Inactive friends' votes remain, with the existing stale-votes note.
- Display nearest-whole Want share and unwanted share on full cards, including 0% unwanted. Tiles show only Want %. Exact utility is Want share minus half unwanted share. Compute the net numerator before dividing so exact-zero cases cannot become positive through percentage rounding. Amber means utility <= 0.
- Find New defaults to Best for You (exact utility). Keep Spotlight and Recently Active. Remove Best Match and the separate Spotlight specialty filter. Mutual fit's explanation lives in How Match Scores Work, not in another toolbar paragraph.
- Mutual fit requires both exact utilities > 0. Newcomers see a vote-first note with All Players available; never fall back to the hidden direction. Saved Neutral votes can produce known 0% Want; a dash means no saved votes or no sending estimate.
- Find New and incoming requests show only the viewer/recipient's side. My Friends shows both directions. Search withholds the other direction unless the caller can see that player's votes.

## API/privacy contract

`browse_all` and `browse_players` return the viewer's Want share, unwanted share and exact utility, plus the per-row `good` flag and existing contact/eligibility metadata. They do not return the hidden direction's score, shares, utility, lift, vote status, shared-vote arrays, or combined score. Sorting and tie-breakers use only the viewer's utility, Spotlight tiers, activity and ID.

The `good` bit is an intentionally accepted disclosure on every All Players row: it tells the viewer whether the pair passes positive utility in both directions. This is needed because filtering and paging run on the client. It is not zero disclosure. The existing global prior also remains a shared aggregate of active players' votes.

Old contact queries are private, revoked helpers called without legacy score work. The unused legacy `get_matches()` endpoint is also revoked so direct calls cannot bypass the new disclosure boundary. Search and request contact/privacy rules are preserved. Individual/private score helpers and admin diagnostics are revoked from public, anon and authenticated. The changed RPC return schemas are announced to PostgREST at commit. Deploy database and app together; the app deliberately does not fall back to the old suggestion response.

## Database and production squash

Dev adds `supabase/migrations/20261026000500_expected_candy_fit.sql` and the follow-up `20261026000600_close_legacy_match_rpc.sql` after the existing applied migrations. Do not rewrite dev's migration log.

The user's requested production squash is **supabase/production/20261026_expected_candy_fit.sql**, generated by:

```sh
scripts/bundle-match-trial.sh > supabase/production/20261026_expected_candy_fit.sql
```

It is one transactional SQL file containing 20261026000000 through 20261026000500 plus the legacy-RPC closure, with an already-installed guard. It requires the earlier schema through 20261025000100. Production should apply this file once after approval, **instead of also applying its individual source files**, and record it through the production agent's normal migration process. It is outside the auto-applied dev migration directory. No production connection or changes were used to prepare it.

## Diagnostics

`public.match_trial_diagnostics(viewers uuid[])` is admin-only and runs on demand; it stores no telemetry. Start with a small sample of viewer UUIDs:

```sql
select * from public.match_trial_diagnostics(array['VIEWER_UUID'::uuid]);
```

It reports per-direction pair/scored/mutual-fit counts, mean utility and its p10/p50/p90, mean unwanted share, and mean/median lift. Lift is utility minus utility under the global mix, in points. Bins 0 / 1–4 / 5+ count voting friends actually feeding each estimate (at least one Want), excluding the receiver. Five friend voters matches the prior's pre-normalization voter weight; final demand shares need not be exactly 50/50.

Use these distributions and representative pairings to choose a later Mutual fit rule. Do not carry forward 25%, 33%, or the old three-candy minimum.

## Validation strategy

- Unit tests cover new defaults/URL compatibility, utility sorting without hidden tie-breakers, negative utilities above missing data, nearest-whole shares, consistent zero-unwanted labels, one-direction cards and exact amber boundaries.
- SQL validation preserves the historical contract/migration replay suites through 0400, then upgrades the populated database and tests the new trial contract. These historical assertions intentionally remain on their original scoring contract; they are not presented as end-state trial tests.
- Trial SQL tests exercise exact 8/4/2 arithmetic, zero/negative/Neutral/missing scores, broad Wants, no Spotlight weight, k=5 baseline/lift, 0/1–4/5+ bins, newbie eligibility, hidden payload fields, private search, recipient-only requests, both-direction friends, skip-self behavior, eligibility/privacy/block gates and actual API-role permissions.
- The same trial suite also runs on a separate database cloned before 0000, after installing only the single production bundle. CI compares the generated bundle with the checked-in artifact.
- Build/type checks and local mobile/desktop Chromium component checks cover cards/tiles, exact amber versus displayed rounded shares, controls, guide, pagination and newcomer flows. Local component checks mock navigation/actions; authenticated hosted smoke tests still require the user's dev session.

## Production-agent review after dev approval

Confirm the target schema and missing prerequisites. Apply the single reviewed squash through the production migration process, coordinate the app deploy, and verify PostgREST has the new return contracts. Inspect actual suggestion/request network responses to confirm no hidden-direction values. Check Mutual fit and All Players with no votes, saved Neutral votes, private votes and some friend data. Check both My Friends directions and an incoming request from each participant's side. Measure the hosted query plan if latency differs from the local synthetic benchmark.

## Local validation measurements

224 unit tests passed. The 34 historical SQL suites ran before the trial upgrade; the trial contract/privacy suite passed on both the upgraded database and the independently installed production squash. Build/type checks and Chromium checks at 390px/1280px passed.

Synthetic PostgreSQL 17 fixture, three warm samples, 107 saved votes per player and a 50-friend list:

| Players | My Friends query | Find New query |
| --- | --- | --- |
| 200 | 123 / 124 / 126 ms | 105 / 105 / 114 ms |
| 2,000 | 322 / 307 / 317 ms | 1,596 / 1,721 / 1,747 ms |

These are local SQL times, not hosted page latency. The score batch keeps one global calculation. An EXPLAIN during validation showed about 1.1 seconds of JIT compilation alone at 2,000 players, so JIT is disabled only for the interactive batch functions, not database-wide. At larger scale, measure the hosted Find New query plan and consider short-lived response caching separately; this trial does not add a scheduled cache.
