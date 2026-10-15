-- Strong name match for Not here yet: the "may have joined" hint and the
-- removal when you add that friend now ignore spaces, separators and
-- decorations as well as case ("Mr_Time" and "★mr time" are "Mr Time"), so a
-- name typed slightly differently isn't silently missed. Spelling still has to
-- match; looser matches stay in search, where the player checks the results.
-- Keep the symbol list in step with SYMBOLS in src/lib/names.ts. Safe to re-run.

create or replace function public.strong_name_key(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- A name that is only symbols keeps them ("★★" only matches "★★").
  select coalesce(
    nullif(translate(regexp_replace(public.search_key(t), '\s', '', 'g'), '_.-''"`~・·•☆★♪♫♬♡♥❤!?*^=+|/\()[]{}<>,:;#@&%$。、', ''), ''),
    public.search_key(t)
  )
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
