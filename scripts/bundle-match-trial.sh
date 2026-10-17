#!/usr/bin/env bash
# Production handoff only: print one transactional replacement for 0000–0500 plus the legacy-RPC closure.
# This script does not connect to a database or apply migrations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cat <<'SQL'
-- Expected candy fit production handoff: squash of 0000–0500 plus the legacy-RPC closure.
-- Requires the schema through 20261025000100. Run once, after dev approval.
-- Do not also apply the individual source files. Dev keeps its existing history.
begin;
do $guard$ begin
  if to_regprocedure('public.trial_pair_scores(uuid,uuid[])') is not null then
    raise exception 'Expected candy fit trial is already installed; do not replay this bundle';
  end if;
end $guard$;
SQL
for name in \
  20261026000000_half_dont_want.sql \
  20261026000100_quarter_tiers.sql \
  20261026000200_pyramid_tiers.sql \
  20261026000300_blend_demand.sql \
  20261026000400_match_context_and_shared_rates.sql \
  20261026000500_expected_candy_fit.sql \
  20261026000600_close_legacy_match_rpc.sql; do
  printf '\n-- Source: %s\n' "$name"
  cat "$ROOT/supabase/migrations/$name"
  printf '\n'
done
printf '\ncommit;\n'
