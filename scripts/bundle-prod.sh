#!/usr/bin/env bash
# Production migration log: prints SQL to paste into the PRODUCTION Supabase
# SQL editor. Like scripts/bundle-migrations.sh for dev, but each migration
# runs in its own transaction, refuses to run twice, and records itself in
# public.applied_migrations. It never connects to a database.
#
#   scripts/bundle-prod.sh --baseline THROUGH > baseline.sql
#     One time: creates the log and records every migration up to and including
#     THROUGH as already applied (check prod's schema first). Runs nothing else.
#
#   scripts/bundle-prod.sh --after LAST > release.sql
#     Every migration after LAST, the newest one production has logged:
#       select max(name) from public.applied_migrations where name ~ '^[0-9]{14}_';
#     (The squash's own row, 20261026_expected_candy_fit.sql, doesn't match that
#     pattern on purpose: it would sort after later same-day migrations.)
#
#   scripts/bundle-prod.sh FROM > release.sql
#     Every migration from FROM (a name or prefix, e.g. 20261021) onward.
#
# 20261026000000-0600 are applied as the single reviewed squash in
# supabase/production/; each source file is logged as applied by it.
# Refuses to run on the dev database (it has the dev seed's dev_player()).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQUASH="20261026_expected_candy_fit.sql"
SQUASHED=(
  20261026000000_half_dont_want.sql
  20261026000100_quarter_tiers.sql
  20261026000200_pyramid_tiers.sql
  20261026000300_blend_demand.sql
  20261026000400_match_context_and_shared_rates.sql
  20261026000500_expected_candy_fit.sql
  20261026000600_close_legacy_match_rpc.sql
)
is_squashed() { local n; for n in "${SQUASHED[@]}"; do [ "$n" = "$1" ] && return 0; done; return 1; }

BASELINE=""
FROM=""
AFTER=""
case "${1:-}" in
  --baseline) BASELINE="${2:?--baseline needs the last migration production already has}" ;;
  --after) AFTER="${2:?--after needs the newest migration production has logged}" ;;
  "") echo "Usage: scripts/bundle-prod.sh --baseline LAST | --after LAST | FROM" >&2; exit 1 ;;
  *) FROM="$1" ;;
esac

cat <<'SQL'
-- Production only (scripts/bundle-prod.sh).
do $prod$ begin
  if to_regprocedure('public.dev_player(text)') is not null then
    raise exception 'This is the dev database; use scripts/bundle-migrations.sh there';
  end if;
end $prod$;
create table if not exists public.applied_migrations (
  name text primary key,
  applied_at timestamptz not null default now(),
  note text
);
alter table public.applied_migrations enable row level security;
revoke all on public.applied_migrations from anon, authenticated;

SQL

if [ -n "$BASELINE" ]; then
  [ -f "$ROOT/supabase/migrations/$BASELINE" ] || ls "$ROOT"/supabase/migrations/"$BASELINE"* >/dev/null 2>&1 \
    || { echo "No migration named $BASELINE" >&2; exit 1; }
  for f in "$ROOT"/supabase/migrations/*.sql; do
    name="$(basename "$f")"
    [[ "$name" > "$BASELINE" && "$name" != "$BASELINE"* ]] && break
    printf "insert into public.applied_migrations (name, note) values ('%s', 'baseline') on conflict do nothing;\n" "$name"
  done
  exit 0
fi


guard() {
  printf "do \$g\$ begin\n  if exists (select 1 from public.applied_migrations where name = '%s') then\n" "$1"
  printf "    raise exception '%s is already applied; rebuild the bundle from the next migration';\n  end if;\nend \$g\$;\n" "$1"
}

squash_done=false
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  [[ -n "$FROM" && "$name" < "$FROM" ]] && continue
  [[ -n "$AFTER" && ! "$name" > "$AFTER" ]] && continue
  if is_squashed "$name"; then
    $squash_done && continue
    squash_done=true
    printf -- '-- ==== %s (replaces %s through %s) ====\nbegin;\n' "$SQUASH" "${SQUASHED[0]}" "${SQUASHED[${#SQUASHED[@]}-1]}"
    for n in "$SQUASH" "${SQUASHED[@]}"; do guard "$n"; done
    # The squash carries its own begin/commit; run it inside this transaction instead.
    grep -v -x -e 'begin;' -e 'commit;' "$ROOT/supabase/production/$SQUASH"
    printf "\ninsert into public.applied_migrations (name, note) values ('%s', null);\n" "$SQUASH"
    for n in "${SQUASHED[@]}"; do
      printf "insert into public.applied_migrations (name, note) values ('%s', 'via %s');\n" "$n" "$SQUASH"
    done
    printf 'commit;\n\n'
    continue
  fi
  printf -- '-- ==== %s ====\nbegin;\n' "$name"
  guard "$name"
  cat "$f"
  printf "\ninsert into public.applied_migrations (name) values ('%s');\ncommit;\n\n" "$name"
done
