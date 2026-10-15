-- Search finds exact names only: same IGN (or shown Discord name) ignoring
-- case and spacing (name_match 1), or with symbols and lookalike characters
-- folded (0.95, e.g. "Jacky*" for "jacky"). Partial names (0.9-0.92) and
-- typo matches (pg_trgm, up to 0.89) are out: "spezy" found "spooky fren".
-- lookup_players keeps its rule; raising the floor does it. Safe to re-run.

create or replace function public.fuzzy_name_min()
returns numeric
language sql
immutable
as $$ select 0.95 $$;
