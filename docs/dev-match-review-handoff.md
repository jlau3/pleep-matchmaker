# Dev match review handoff

Scope: dev branch `claude/pokemon-sleep-matchmaking-esw90a`. This work does not authorize production changes. The user will review dev before handing it to the production agent.

## Behavior

- My Friends calculates current Everyone Want rates once per `get_friends` RPC and passes them to private helpers for both directional scores. No persistent cache, scheduled refresh, weight change, or score change.
- Friend/search/suggestion cards and suggestion grids label each available score independently: Everyone estimate, Friends + Everyone, or Friends. `player_extras` supplies the context; it retains existing icon, Reddit, private-vote and block rules. Voting activity is unknown for players whose votes the viewer cannot see.
- Extras requests are split into 200-player batches, matching the existing RPC limit, so larger suggestion lists also receive context.
- Missing scores explain whose votes are needed when known; otherwise they say there is not enough voting data. Source labels are omitted for missing scores.
- Shared Tier List URLs include every selected style explicitly, including `style=standard` (Percentile). Explicit links override a recipient's saved style; normal navigation still remembers the last style.
- Cards and exports retain the existing whole-number formatter. Score explanations no longer introduce a different rounded number. Wording distinguishes Everyone's seen-player denominator from My Friends' voting-friend denominator.
- Style explanations use parallel purpose statements. Percentile acknowledges ties and zero scores; F requires more than twice as many Don't Want votes as Want votes. The scoring formula and bucketing behavior are unchanged.

## Database changes

New migration: `supabase/migrations/20261026000400_match_context_and_shared_rates.sql`.

Requires the earlier dev matching migration `20261026000300_blend_demand.sql` and its prerequisites. Before any authorized production migration, check production's applied migration state and include missing prerequisites in order.

The new migration preserves `get_friends(boolean)`'s signature and existing privacy/contact expressions. It adds private rate-aware scoring helpers and recreates `player_extras(uuid[])` with additive result columns, restoring authenticated-only execution. Deploy the database migration before relying on the new source labels. Older app code tolerates the added columns; newer app code can render without context if the older RPC is still installed.

Historical fresh-install repair: `20261021000200_reddit_friends_only.sql` now drops/recreates `player_extras` before changing its return columns, with explicit grants restored. Already-applied copies need not be rerun. The friend-request migration replay test restores the new migration after replaying older definitions.

## Validation

- 218 unit tests in 36 files passed, including directional missing-score wording, labels in list/grid views and extras batching/failure handling.
- All 34 SQL test files passed on a throwaway PostgreSQL 17 database, including score equivalence, source direction, privacy/block protection and helper permissions.
- Type checking and the Next.js production build passed.
- Local Chromium checks at 390px and 1280px passed: conflicting remembered-style recipient, score tooltip, ties, 50-player ranking threshold, export, help and horizontal overflow. Mobile suggestion-card labels were visually inspected. These checks used actual app components with local service/navigation mocks, not the deployed authenticated site.

## Performance measurement

Synthetic local PostgreSQL fixture: 107 saved candy votes per player, 50 viewer friends, ten additional voting friends per candidate. Compared the original `get_friends` definition with the optimized definition on identical data, checked equality of every directional score, warmed both queries, then took three samples each.

| Players / saved votes | Original samples | Optimized samples |
| --- | --- | --- |
| 200 / 21,400 | 808, 745, 738 ms | 402, 377, 318 ms |
| 2,000 / 214,000 | 5,197, 6,459, 5,347 ms | 302, 558, 321 ms |

These are local SQL measurements, not a hosted latency promise. Other validation work ran concurrently. No production data or database was used for this benchmark.

## Production-agent checks after user approval

Review the migration against production's actual schema and missing prerequisites. Verify authenticated My Friends, incoming requests, search and both suggestion layouts after the database/app rollout. Check the two source labels with zero and some voting friends, plus a private-vote player. Verify a shared Percentile URL against a browser that last selected Fixed Scores. Recheck the full friend-list query on the hosted database if its plan differs materially from the local fixture.
