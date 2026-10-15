#!/usr/bin/env bash
# Concatenates every migration, in order, into one file to paste into the dev
# Supabase project's SQL editor (the database behind Vercel previews), and
# records each in public.dev_applied_migrations so scripts/dev-migrate.sh (the
# Dev database migrations workflow) only applies newer ones after it.
# Usage: scripts/bundle-migrations.sh [from-prefix] > all.sql
#   from-prefix (optional): start at the first migration whose name sorts at
#   or after it, e.g. 20261020 for only the newer ones.
#        scripts/bundle-migrations.sh --mark-only > mark.sql
#   records every migration as applied without running any (for a dev
#   database loaded before the log existed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARK_ONLY=false
FROM=""
case "${1:-}" in
  --mark-only) MARK_ONLY=true ;;
  *) FROM="${1:-}" ;;
esac
cat <<'SQL'
-- Dev database only: which migrations have run here (scripts/dev-migrate.sh).
create table if not exists public.dev_applied_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
revoke all on public.dev_applied_migrations from anon, authenticated;
alter table public.dev_applied_migrations enable row level security;

SQL
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  [[ -n "$FROM" && "$name" < "$FROM" ]] && continue
  if ! $MARK_ONLY; then
    printf -- '-- ==== %s ====\n' "$name"
    cat "$f"
    printf '\n'
  fi
  printf "insert into public.dev_applied_migrations (name) values ('%s') on conflict do nothing;\n\n" "$name"
done
