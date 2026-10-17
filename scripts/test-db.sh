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
