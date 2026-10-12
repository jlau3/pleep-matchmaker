-- A want on one side and a don't-want on the other no longer costs points
-- (was -3). Don't-want means "I don't need this candy", not a clash: that
-- player simply isn't competing for it. The line still counts toward the best
-- case, so a mismatch lowers the % a little; it just isn't punished.
-- Same signature, so get_matches and pair_match_pct pick it up as-is.

create or replace function public.match_config()
returns table (
  w_both_want int,
  w_both_dont int,
  w_conflict int,
  min_pct numeric,
  min_shared_wants int,
  stale_after interval
)
language sql
immutable
as $$
  select 3, 1, 0, 25.0, 3, interval '4 months'
$$;
