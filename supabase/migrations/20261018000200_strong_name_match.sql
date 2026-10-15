-- Strong name match for Not here yet: the "may have joined" hint and the
-- removal when you add that friend now ignore spaces, separators and
-- decorations as well as case ("Mr_Time" and "★mr time" are "Mr Time"), so a
-- name typed slightly differently isn't silently missed. Spelling still has to
-- match; looser matches stay in search, where the player checks the results.
-- Names that are only symbols (valid IGNs) keep them, with lookalikes folded,
-- and search finds them that way too ("☆" finds "★").
-- The symbol lists come from src/lib/names.ts (names.test.ts checks they
-- match). Safe to re-run.

create or replace function public.strong_name_key(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- A name that is only symbols keeps them, with lookalikes folded ("☆" = "★", not "♪").
  with c as (select regexp_replace(public.search_key(t), '[\s\uFE0E\uFE0F]', '', 'g') as s)
  select coalesce(
    nullif(translate(c.s, '_.-''"`!?*^=+|/\()[]{}<>,:;#@&%$。、★☆✩✪✫✬✭✮✯✰⭐🌟♥♡❤❥❣💕💗💖💓💞💘💝🧡💛💚💙💜🤍🖤🤎♪♫♬♩🎵🎶●○◦◯⚪⚫・·•~〜', ''), ''),
    translate(c.s, '★☆✩✪✫✬✭✮✯✰⭐🌟♥♡❤❥❣💕💗💖💓💞💘💝🧡💛💚💙💜🤍🖤🤎♪♫♬♩🎵🎶●○◦◯⚪⚫・·•~〜', '★★★★★★★★★★★★♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♪♪♪♪♪♪○○○○○○・・・~~')
  )
  from c
$$;

create index if not exists profiles_ign_strong_key_idx on public.profiles (public.strong_name_key(ign));

-- Adding a friend whose IGN matches a placeholder (strong_name_key) settles it.
create or replace function public.clear_friend_placeholder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friend_placeholders fp
  using public.profiles pr
  where pr.id = new.friend_id
    and fp.user_id = new.user_id
    and public.strong_name_key(fp.name) = public.strong_name_key(pr.ign);
  return new;
end
$$;

drop trigger if exists friends_clear_placeholder on public.friends;
create trigger friends_clear_placeholder after insert on public.friends
  for each row execute function public.clear_friend_placeholder();

-- Your placeholders, oldest first, each with whether a player with the same
-- IGN (strong_name_key) can be found here now (same rules as lookup: allow_lookup, no blocks).
create or replace function public.get_friend_placeholders()
returns table (name text, created_at timestamptz, signed_up boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fp.name,
    fp.created_at,
    exists (
      select 1 from public.profiles pr
      where pr.allow_lookup
        and pr.id <> auth.uid()
        and public.strong_name_key(pr.ign) = public.strong_name_key(fp.name)
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
             or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
        )
    )
  from public.friend_placeholders fp
  where fp.user_id = auth.uid()
  order by fp.created_at
$$;

revoke execute on function public.get_friend_placeholders() from public, anon;
grant execute on function public.get_friend_placeholders() to authenticated;

-- Search: the "same name" tier uses strong_name_key, so lookalike symbols and
-- separators count as the same name (still exact spelling). As in
-- 20261018000000_tighter_fuzzy_search.sql otherwise.
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
    when public.strong_name_key(name) = public.strong_name_key(q) then 0.95
    when k.q_words = '' then null
    when strpos(' ' || k.words, ' ' || k.q_words) > 0 then 0.92
    when strpos(replace(k.words, ' ', ''), replace(k.q_words, ' ', '')) > 0 then 0.9
    when char_length(k.q_words) < 5 then null
    else least(extensions.word_similarity(q, k.key)::numeric, 0.89)
  end
  from k
$$;
