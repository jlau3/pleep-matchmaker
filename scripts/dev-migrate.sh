#!/usr/bin/env bash
# Applies migrations the DEV database hasn't run yet, oldest first, each in
# its own transaction together with its entry in public.dev_applied_migrations.
# Run by the Dev database migrations workflow on every push that touches
# supabase/migrations; runnable by hand too:
#   DATABASE_URL='postgresql://...' scripts/dev-migrate.sh
#
# Refuses any database without the dev seed's helpers and the migration log
# (scripts/dev_seed.py, scripts/bundle-migrations.sh), so it can't run on
# production even with the wrong connection string.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL (the DEV_DATABASE_URL secret) isn't set; nothing to do."
  exit 0
fi
PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

dev=$("${PSQL[@]}" -tAc "select to_regprocedure('public.dev_player(text)') is not null and to_regclass('public.dev_applied_migrations') is not null")
if [ "$dev" != "t" ]; then
  echo "Refusing: this isn't the dev database (no dev seed helpers or migration log)." >&2
  exit 1
fi

applied=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  done_already=$("${PSQL[@]}" -tAc "select exists (select 1 from public.dev_applied_migrations where name = '$name')")
  [ "$done_already" = "t" ] && continue
  echo "Applying $name"
  "${PSQL[@]}" --single-transaction -f "$f" -c "insert into public.dev_applied_migrations (name) values ('$name')"
  applied=$((applied + 1))
done
echo "Applied $applied new migration(s)."
