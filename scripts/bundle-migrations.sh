#!/usr/bin/env bash
# Concatenates every migration, in order, into one file to paste into a fresh
# Supabase project's SQL editor (e.g. the dev project behind Vercel previews).
# Usage: scripts/bundle-migrations.sh [from-prefix] > all.sql
#   from-prefix (optional): start at the first migration whose name sorts at
#   or after it, e.g. 20261020 for only the newer ones.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FROM="${1:-}"
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  [[ -n "$FROM" && "$name" < "$FROM" ]] && continue
  printf -- '-- ==== %s ====\n' "$name"
  cat "$f"
  printf '\n'
done
