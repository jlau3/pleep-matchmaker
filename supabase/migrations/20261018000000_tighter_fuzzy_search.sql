-- Tighter name search. Trigram scores on short queries were noisy ("mrl"
-- scored 0.5 against "Mr Time", right on the old cutoff), so matching is now
-- mostly plain substring, ignoring case, spaces and _ . -:
--   1     exact (normalized) name, as before
--   0.95  same name ignoring separators ("mrtime" finds "Mr Time")
--   0.92  a word in the name starts with the query ("tim" finds "Mr Time")
--   0.9   the name contains the query anywhere ("orla" finds "Snorlax")
--   typos only for 5+ character queries: pg_trgm word similarity >= 0.6
--         ("snorlx" finds "Snorlax"), capped below the scores above.
-- Search still needs 3+ characters for anything but an exact name, and
-- returns at most 10. lookup_players is unchanged; it calls name_match and
-- fuzzy_name_min. Safe to re-run.

create or replace function public.fuzzy_name_min()
returns numeric
language sql
immutable
as $$ select 0.6 $$;

create or replace function public.name_match(name text, q text)
returns numeric
language sql
stable
set search_path = ''
as $$
  with k as (
    select
      public.search_key(name) as key,
      -- Separators (space, _ . -) as single spaces.
      btrim(regexp_replace(public.search_key(name), '[\s_.\-]+', ' ', 'g')) as words,
      btrim(regexp_replace(q, '[\s_.\-]+', ' ', 'g')) as q_words
  )
  select case
    when name is null or q is null or q = '' then null
    when k.key = q then 1
    when k.q_words = '' then null
    when replace(k.words, ' ', '') = replace(k.q_words, ' ', '') then 0.95
    when strpos(' ' || k.words, ' ' || k.q_words) > 0 then 0.92
    when strpos(replace(k.words, ' ', ''), replace(k.q_words, ' ', '')) > 0 then 0.9
    when char_length(k.q_words) < 5 then null
    else least(extensions.word_similarity(q, k.key)::numeric, 0.89)
  end
  from k
$$;
