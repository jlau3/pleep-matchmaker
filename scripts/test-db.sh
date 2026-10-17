#!/usr/bin/env bash
# Runs the migration and matching tests against a throwaway local Postgres.
# Needs Postgres server binaries (initdb, pg_ctl) and psql on PATH or in
# /usr/lib/postgresql/*/bin. The cluster is UTF-8 like Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DATA="$(mktemp -d)"
PORT="${PGTEST_PORT:-55432}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$DATA"
  RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/auth_stub.sql"
# The trial deliberately changes the public matching contract. Preserve the
# historical score/migration-replay regression suite on its original contract,
# then migrate that populated database and test the new contract/privacy rules.
TRIAL_MIGRATION="20261026000500_expected_candy_fit.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  if [[ "$(basename "$f")" == 20261026000000_* ]]; then
    "${PSQL[@]}" -c 'create database trial_squash template postgres'
  fi
  [[ "$(basename "$f")" < "$TRIAL_MIGRATION" ]] && "${PSQL[@]}" -f "$f"
done
for t in "$ROOT"/supabase/tests/*_test.sql; do
  [[ "$(basename "$t")" == trial_* ]] || "${PSQL[@]}" -f "$t"
done
for f in "$ROOT"/supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "$TRIAL_MIGRATION" ]] || "${PSQL[@]}" -f "$f"
done
for t in "$ROOT"/supabase/tests/trial_*_test.sql; do "${PSQL[@]}" -f "$t"; done
# Validate the single production bundle from its real pre-0000 schema, without
# historical fixture state or running its source migrations individually.
"$ROOT/scripts/bundle-match-trial.sh" | cmp - "$ROOT/supabase/production/20261026_expected_candy_fit.sql"
SQUASH_PSQL=(psql -h /tmp -p "$PORT" -U postgres -d trial_squash -v ON_ERROR_STOP=1 -q)
"${SQUASH_PSQL[@]}" -f "$ROOT/supabase/production/20261026_expected_candy_fit.sql"
for t in "$ROOT"/supabase/tests/trial_*_test.sql; do "${SQUASH_PSQL[@]}" -f "$t"; done

# Incremental dev refresh: verify preservation, varied scores, caps and replay
# without mixing synthetic development data into any migration or bundle.
"${PSQL[@]}" -c 'create database dev_match_seed template trial_squash'
SEED_PSQL=(psql -h /tmp -p "$PORT" -U postgres -d dev_match_seed -v ON_ERROR_STOP=1 -q)
"${SEED_PSQL[@]}" -c 'alter table auth.users add column created_at timestamptz default now(); create table public.dev_applied_migrations(name text primary key);'
python3 "$ROOT/scripts/dev_seed.py" > "$DATA/base-seed.sql"
python3 "$ROOT/scripts/dev_match_seed.py" > "$DATA/match-seed.sql"
"${SEED_PSQL[@]}" --single-transaction -f "$DATA/base-seed.sql" >/dev/null
"${SEED_PSQL[@]}" -f "$ROOT/scripts/dev-match-seed-test.sql"
"${SEED_PSQL[@]}" --single-transaction -f "$DATA/match-seed.sql"
"${SEED_PSQL[@]}" -f "$ROOT/scripts/dev-match-seed-check.sql"
"${SEED_PSQL[@]}" -c 'create table seed_vote_snapshot as select user_id,line_id,choice,top from public.preferences; create table seed_graph_snapshot as select user_id,friend_id from public.friends;'
"${SEED_PSQL[@]}" --single-transaction -f "$DATA/match-seed.sql" >/dev/null
"${SEED_PSQL[@]}" -f "$ROOT/scripts/dev-match-seed-check.sql"
"${SEED_PSQL[@]}" -c "do \$\$ begin
 assert not exists((table seed_vote_snapshot except select user_id,line_id,choice,top from public.preferences) union all (select user_id,line_id,choice,top from public.preferences except table seed_vote_snapshot)), 'votes changed on replay';
 assert not exists((table seed_graph_snapshot except select user_id,friend_id from public.friends) union all (select user_id,friend_id from public.friends except table seed_graph_snapshot)), 'friend graph changed on replay';
end \$\$;"
"${SEED_PSQL[@]}" -c 'drop table public.dev_applied_migrations'
if "${SEED_PSQL[@]}" --single-transaction -f "$DATA/match-seed.sql" >"$DATA/guard.log" 2>&1; then
  echo 'ERROR: match seed accepted a database without the dev marker' >&2
  exit 1
fi
grep -q 'not an initialized dev trial database' "$DATA/guard.log"
echo 'Dev match seed: preservation, uniqueness, score variation, replay and dev guard passed.'
