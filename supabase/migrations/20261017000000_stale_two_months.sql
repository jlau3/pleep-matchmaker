-- Inactive after 2 months instead of 4. New lines come out monthly, so an
-- active player checks in at least once a month for the new Tier List.
-- Everything reads match_config().stale_after: Find New Friends (who's
-- suggested), the Everyone tier list and the active-player counts.
-- Same values otherwise. Safe to re-run.

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
  select 3, 1, 0, 25.0, 3, interval '2 months'
$$;
