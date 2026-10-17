# Expected candy fit trial: dev handoff

Work stays on `claude/pokemon-sleep-matchmaking-esw90a`. Production application is not authorized; the user will approve dev and hand it to the production agent.

## Final handoff status

Application commit reviewed: `48443d6` (Poké Ball/Snorlax). Its [full CI run](https://github.com/jlau3/pleep-matchmaker/actions/runs/39075747516) passed dependency installation, type checking, unit tests (241 across 40 files), throwaway-database migration/privacy/seed tests, and the production build. The checked-in matching squash matches its generator. [Dev preview](https://pleep-matchmaker-92x9jtz0i-snackson5.vercel.app) deployed successfully. The latest schema-changing dev workflow at `37c0705` also succeeded. A subsequent deeper review identified the tier/Spotlight/resize/scaling gaps resolved below; the trial's final Mutual Fit thresholds remain a later product decision based on diagnostics.

Production agent release order, after user approval:

1. Inspect the live migration history and schema. The matching bundle requires prerequisites through `20261025000100`; identify any missing earlier migrations rather than assuming dev and production match.
2. Apply `supabase/production/20261026_expected_candy_fit.sql` once, replacing source migrations `20261026000000`–`20261026000600`. Record this replacement in the production migration process so a later runner cannot apply those files again.
3. Apply the separate follow-ups in order: `20261026000700_replay_onboarding.sql`, `20261026000800_hidden_suggestion_names.sql`, `20261026000900_merge_sized_avatars.sql`, `20261026001000_suggestion_filter_flags.sql`, `20261026001100_align_friend_tiers.sql`, and `20261026001200_bounded_candidate_batches.sql`. Record each. The onboarding reset runs once for this release, not on every deploy.
4. Coordinate the application release with these RPC changes and verify PostgREST schema reload. Keep production environment bindings; development seeds, acceptance helpers, database connections and fixture-refresh scripts stay in dev.
5. Run authenticated hosted checks: first/returning/prefilled onboarding; unchanged privacy settings through Profile; vote auto-advance and filtered exports; suggestion filters/declines; incoming requests and both friend directions. Inspect suggestion payloads to ensure the hidden direction remains absent. Check signed-out public Tier List/Guides and the Poké Ball overview, then signed-in Snorlax without URL/scroll changes.

Hosted checks require real browser sessions and are not implied by local component tests or green CI. The prior performance samples below are synthetic local SQL measurements. No production database or deployment was changed during this finalization.

## Contextual help and onboarding replay release

After the matching bundle, apply `supabase/migrations/20261026000700_replay_onboarding.sql` once alongside the contextual-help app release. This separately resets only `help_seen_version`, `setup_done`, `vote_guide_seen` and `match_guide_seen`. It preserves identities, privacy, availability, votes, Spotlight, friends and requests. Do not repeat the reset on subsequent releases. Dev uses its normal migration log; do not add this migration to the matching squash.

The app uses version 2 browser markers for the checklist, snooze, Profile dismissal and Tier List tour, so old dismissal cookies cannot suppress this replay. Existing sessions start at guided Profile on their next rendered visit, preserving the original destination; sign-ins use the same rule. Opening guided Profile records the legacy onboarding marker and refreshes the shared layout so subsequent navigation is not redirected again. Existing votes/friends remain checked only after their corresponding guides have opened. Completing or dismissing setup is still remembered normally.

The navbar ? now opens the current page's help: match scores on My Friends/Find New Friends, How to Vote, the Profile walkthrough or Tier List walkthrough. Other pages link to Guides; the redundant Getting Started overview is removed. First-visit page guides remain, the automatic welcome is removed, and the sign-in sheet keeps a short What You Get list.

Follow the replay migration with `20261026000800_hidden_suggestion_names.sql`. It adds the authenticated owner-only restore-list RPC; closed, inactive or full players retain their IGN independently of current suggestions, while lookup-off non-friends and blocked players return no name. It returns no votes, contact fields or fit. Visiting the Tier List no longer finishes setup: the last tour step or an explicit Finish setup does. Tours wait for checklist hydration and track page-height changes so highlights stay aligned. The match guide uses the agreed short explanation with its calculation collapsed.

Regression matrix: check new, partial Profile, saved Profile/no votes, saved votes/no friends, fully prefilled, and previously completed accounts. A Tier List visit must not call setup completion. Got it on the final tour step completes only when the prior steps are done; Skip/Esc leaves setup unfinished, with Finish setup available for players who already saw the tour. Check highlights after checklist hydration and late banner changes on mobile and tall desktop windows. Run a prefilled Profile through every step without altering privacy radios/social toggles. Hidden restores must retain eligible-to-view IGNs outside browse_all, redact blocked/lookup-off identities, and never read another account's list.

Voting list auto-advance uses one native scrollIntoView call to the specific next card, after a successful save and its layout updates. A measured scroll margin reserves the sticky site header; the vote toolbar is no longer sticky. Every List vote tap advances once, including confirming or changing an existing vote. Manual interaction cancels pending advances; failed or stale saves and Grid do not advance. There is no ongoing body/viewport recentering. Check long All-list runs, fast taps, delayed/out-of-order saves, first-save checklist changes, Neutral filters as voted cards leave the list, tall navigation, and cancellation by manual scrolling.

## Trial behavior

- Count friends' Wants, add the existing k=5 global prior, and normalize total demand into sending shares. Do not divide a friend's contribution across their Wants or weight Spotlight. Exclude the receiver from a sender's existing friends. Inactive friends' votes remain, with the existing stale-votes note.
- Display nearest-whole Want share and unwanted share on full cards, including 0% unwanted. Tiles show only Want %. Exact utility is Want share minus half unwanted share. Compute the net numerator before dividing so exact-zero cases cannot become positive through percentage rounding. Amber means utility <= 0.
- Find New defaults to Best for You (exact utility). Keep Spotlight and Recently Active. Remove Best Match. The optional Spotlight/F filter lives in the combined Filters dropdown. Mutual fit's explanation lives in How Match Scores Work, not in another toolbar paragraph.
- Mutual fit requires both exact utilities > 0. Newcomers see a vote-first note with All Players available; never fall back to the hidden direction. Saved Neutral votes can produce known 0% Want; a dash means no saved votes or no sending estimate.
- Find New and incoming requests show only the viewer/recipient's side. My Friends shows both directions. Search withholds the other direction unless the caller can see that player's votes.

## API/privacy contract

`browse_candidate_batch`, `browse_all` and `browse_players` return the viewer's Want share, unwanted share and exact utility, plus the per-row `good` flag and existing contact/eligibility metadata. They do not return the hidden direction's score, shares, utility, lift, vote status, shared-vote arrays, or combined score. Sorting and tie-breakers use only the viewer's utility, Spotlight tiers, activity and ID.

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

At the earlier matching milestone, 224 unit tests passed. The 34 historical SQL suites ran before the trial upgrade; the trial contract/privacy suite passed on both the upgraded database and the independently installed production squash. Build/type checks and Chromium checks at 390px/1280px passed.

Synthetic PostgreSQL 17 fixture, three warm samples, 107 saved votes per player and a 50-friend list:

| Players | My Friends query | Find New query |
| --- | --- | --- |
| 200 | 123 / 124 / 126 ms | 105 / 105 / 114 ms |
| 2,000 | 322 / 307 / 317 ms | 1,596 / 1,721 / 1,747 ms |

These are local SQL times, not hosted page latency. The score batch keeps one global calculation. An EXPLAIN during validation showed about 1.1 seconds of JIT compilation alone at 2,000 players, so JIT is disabled only for the interactive batch functions, not database-wide. At larger scale, measure the hosted Find New query plan and consider short-lived response caching separately; this trial does not add a scheduled cache.

## Filter and control polish

Unselected pills use a shared contrasting fill in light and dark themes, including voting, feedback, layout, profile, and friend-page controls. My Votes combines vote, island, and sleep-type filters; Search and the All vote button have been removed. Tapping a selected vote filter clears it. Its island icons and colored sleep-type pills come from the same CandyFilters component as Tier List. Mythicals (Mew and Darkrai) match every sleep type while retaining island restrictions, shared with Tier List/export filtering. Incoming Friend Requests can be collapsed and start expanded so new requests remain visible. Best Match scoring is unchanged pending product discussion about broad Want lists and baseline comparisons.

## Review of recent parallel-agent changes

Reviewed 3bac3af (merged Pumpkaboo/Gourgeist icons), fdce4a5 (blocking copy), and e0240c9 (dev request acceptance helper). No blocking app issue found. Legacy per-size avatar keys resolve to the merged assets, and profile saves normalize them. All listed avatar variants have files; normal Pumpkaboo/Gourgeist assets were also visually checked. The dev acceptance helper is restricted to fake recipients and revoked from public, anon, and authenticated roles. It remains a dev-only tool.

The production agent should include `supabase/migrations/20261026000900_merge_sized_avatars.sql` separately after the matching bundle; it is not part of that squash. Old keys remain readable before this data normalization. This review does not authorize production changes.

Also reviewed the subsequently fetched 8f63fc4–bf19e02 changes (ranking copy, score tooltips, immediate Profile updates, persistent route-group sub-tabs, and collapsible Guides). Preserved them during rebase. Corrected the guide's 50-candy ceiling: a report can give two candies. The 3/1/0 score framing is mathematically equivalent to the existing formula, but adds another explanatory scale; retained for product review. Type checking, unit tests and shared-filter walkthrough/browser checks were rerun on the combined tree. The isolated PostgreSQL migration, matching/privacy, squash, and seed replay checks passed; no remote database was changed by this review.

## My Votes hierarchy and export

My Votes now orders controls as an Export Image pill matching Tier List on the right of the Island heading, island icons, sleep types with vote filters aligned to the right, the full Top 3 Spotlight, then the community-votes toggle with List/Grid on its right, immediately above voting cards. The colored sticky toolbar is removed; auto-advance reserves only the fixed site header. Exported vote rows, counts and filter labels reflect the exact active island/sleep/vote filters, excluding the brief lingering undo cards. Spotlight stays complete on the page and in exports regardless of filters. New-Pokémon prompts also respect the active filters. Mobile wraps the two filter groups without horizontal overflow.

## Find New Friends filter controls

All Players is now the default. A single Filters dropdown beside Sort combines Mutual Fit, Active This Week (past seven days), Has Voting Friends (list_voters > 0), and None of My Spotlight in F (every selected candy has a known S/A/B/C rank on their friends' Tier List). All filters default off, combine with AND, reset pagination, survive URL/reload, and use existing disclosed fields. Server first-page Spotlight loading applies the same filter helper as the client. Clear Filters restores all eligible suggestions without changing the selected sort. Legacy explicit show=all and show=good links still resolve; new mutual-only links use show=mutual. No scoring, privacy, activity eligibility or database payload changes. Mutual-friend filtering is excluded pending a relationship disclosure policy; the Spotlight/F filter is now authorized and implemented, excludes unranked/missing tiers, and waits for full rank loading before filtering.

## New-player and declined-request filters

Checked existing behavior before implementing: trial_candidates does not exclude declines; loadRelations keeps outgoing declines but discards incoming ones. The new optional filter uses current declined requests in either direction. Cleared/resubmitted history is unavailable. New to Pleep means profile creation within 14 days (inclusive).

Apply `20261026001000_suggestion_filter_flags.sql` separately after the matching bundle, alongside this app deploy. Its authenticated RPC returns only is_new and has_declined for caller-eligible suggestions, without exact creation times or third-party relationship details. The final app loads these same coarse flags inside browse_candidate_batch, using one query snapshot with the candidate eligibility and scores; the separate flags RPC remains available for older callers. Dev migration workflow applies this migration automatically; production still requires user approval. SQL privacy/boundary tests passed on incremental migrations and the standalone bundle plus this migration.

My Votes community label now reads Show XX active community votes, with X out of X candies underneath and List/Grid beside it. Find Filters anchors directly to its button and adjusts for viewport edges. Main navbar remains the existing roughly 48px sticky bar; secondary page tabs scroll normally.

## Navbar arrangement

Keep logo and page tabs together on the left, with help and feedback/support (or Sign in) grouped at the right edge. Stars occupy the flexible gap between those groups and the outer desktop margins on both sides of the navigation, in a balanced staggered pattern: none below 56px of free space, one at 56px, three at 140px, seven at 320px. Checks at 320/390/768/1280px cover signed-in, visitor and support-enabled layouts; the header remains 48px sticky, utility buttons stay adjacent, and stars do not overlap controls. Secondary page tabs remain in normal document flow.

## Poké Ball interaction

Visitors open an updated, deliberate What Pleep Does overlay from the Poké Ball, covering public Global Tier List/exports/Guides and account features (Profile, saved votes, Spotlight, friend matching, friends' Tier List). The ? remains page-specific. Sign in keeps the current destination. Signed-in clicks do not navigate: Snorlax drops on its first static frame, plays the supplied 59-frame APNG once, holds its final frame, and resets to the first frame before falling off-screen when clicked. Each appearance independently randomizes its horizontal position and landing depth across the visible viewport, leaving 16px edges and keeping the whole sprite below the navbar. The shiny version rolls once per appearance at 1/500. Repeated logo clicks do not stack sprites; reduced-motion mode uses a static pose and instant arrival/removal.

Sprites are served locally from public/easter-eggs/snorlax with source attribution. prepare_snorlax.py preserves all frame pixels and timing while changing only APNG's play count to one; it extracts first/rest frames and rejects flattened static sources. Both originals contain 59 frames totaling about 2.875 seconds. Browser frame snapshots verified motion then a frozen final pose for both real sprites, with first-frame reset on exit. Visitor/signed-in checks preserve URL, scroll, page state and document height at mobile/desktop sizes; normal/shiny/reduced-motion/replay paths passed. 241 unit tests and type checking passed.

## Final review corrections

Two separate follow-up migrations after 01000 (not edits to the previously applied squash):

- `20261026001100_align_friend_tiers.sql` counts any saved friend vote, including Neutral-only, in `list_tiers`/`top3_tiers_set`. Spotlight uses exactly the actual Percentile tier: zero/unvoted candy is C and only a negative score is F. One voting friend is enough for badges; only a list with no saved votes stays unavailable. Caller-owned `get_friend_voters()` supplies the My Friends pool denominator without exposing individual votes. Anonymous callers cannot access it.
- `20261026001200_bounded_candidate_batches.sql` adds authenticated `browse_candidate_batch(after_id, batch_size)`. Select at most 500 eligible IDs after the cursor before scoring them; return only the viewer's direction, accepted Mutual Fit bit, and coarse filter flags. Existing eligibility/privacy/block/availability rules are unchanged. The app loads every batch, then sorts/filters/pages the complete population. A failed batch fails the load rather than mislabeling a partial population as All Players. Legacy browse_all no longer has its SQL 1,000 limit; API clients should still use the bounded RPC.

Spotlight lookups use 200-player batches (at most 600 rows for three candies, below PostgREST's default 1,000-row response cap). Both the server action and loader preserve IDs after the first 1,000. Badges/filter hints explicitly say Percentile because a player's remembered display style can differ. Unknown partial badge data shows a dash rather than an invented F.

Snorlax responds to viewport resize/rotation and visual-viewport changes by updating its landing transform, without restarting its drop or the intrinsic animation. Browser checks confirm the sprite stays clickable after portrait-to-landscape rotation, plus the play-once/reset-on-dismiss sequence. Named sort controls now use Best Match, Best for You, and Recently Active; named Mutual Fit/All Players references follow the same capitalization, while explanations retain sentence case.

Validation: 245 unit tests across 42 files and type checking pass. The full local PostgreSQL suite passes on incremental dev migrations and the independently installed squash, including the new follow-ups, 1,118-account pagination fixture, blocked/lookup-off exclusions, cursor coverage/uniqueness, per-batch bounds, coarse flags, hidden-direction omission, Neutral-only/unsaved friends, and Spotlight zero/negative/single-voter cases. Historical tests keep their historical behavior before these new migrations. The production agent still runs authenticated hosted smoke checks after applying all follow-ups.

Scaling tradeoff: batching removes silent truncation and avoids scoring the entire population for every page request, but initial payload/memory and background Spotlight work still grow with eligible-player count. If hosted latency or browser cost becomes excessive, move filter/sort/pagination to server queries under the same privacy contract; this release does not claim constant-time loading or a single snapshot spanning all batches.
