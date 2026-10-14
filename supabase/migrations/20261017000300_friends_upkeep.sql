-- Friend list upkeep. Safe to re-run.
--
-- 1. "Open to new friends" off hides your friend code from search results,
--    except to friends and to someone who searched that exact code (you stay
--    findable by it).
-- 2. Removing a friend removes you from their list too: the lists mirror the
--    in-game one, and unfriending in Pokémon Sleep is two-sided.
-- 3. Placeholders: in-game friends who haven't signed up yet, kept by IGN so
--    you remember to look for them. Adding a friend with that IGN clears one.

-- 1. Friend code hidden when closed (lookup_players as in fuzzy_search, plus that rule).
create or replace function public.lookup_players(q text)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  wants text[],
  dont_wants text[],
  top_wants text[],
  match_pct int,
  you_fit_pct int
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  needle as (
    select
      public.search_key(trim(both '@ ' from q)) as text_q,
      nullif(regexp_replace(q, '[^0-9]', '', 'g'), '') as digits_q
  ),
  -- Each findable name's key (Discord names only when shown), scored against the query:
  -- 1 for an exact match, else pg_trgm word similarity (typos, partial names).
  scored as (
    select pr.*,
      greatest(
        case when pr.show_discord then public.name_match(pr.discord_username, n.text_q) end,
        case when pr.show_discord then public.name_match(pr.discord_display_name, n.text_q) end,
        public.name_match(pr.ign, n.text_q),
        case when char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q then 1 end
      ) as score,
      coalesce(char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q, false) as code_hit
    from public.profiles pr, needle n
    where pr.allow_lookup
      and char_length(n.text_q) >= 2
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
  ),
  -- Exact matches from 2 characters; close ones from 3, at most 10, best first.
  hits as (
    select s.*
    from scored s, needle n
    -- You only find yourself by exact name (the page then says "That's you").
    where s.score = 1 or (s.id <> auth.uid() and char_length(n.text_q) >= 3 and s.score >= public.fuzzy_name_min())
    order by s.score desc, s.last_seen_at desc
    limit 10
  )
  select
    h.id,
    case when h.show_discord then h.discord_username end,
    case when h.show_discord then h.discord_display_name end,
    case when h.show_discord then h.avatar_url end,
    h.ign,
    -- Closed to new friends: the code shows only to someone who typed it, to
    -- friends (either way round), and to themselves.
    case when h.open_to_friends or h.code_hit or h.id = auth.uid()
           or exists (select 1 from public.friends f
                      where (f.user_id = auth.uid() and f.friend_id = h.id)
                         or (f.user_id = h.id and f.friend_id = auth.uid()))
         then h.friend_code end,
    h.last_seen_at,
    h.prefs_updated_at,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.top), '{}'),
    case when h.id <> auth.uid() then public.fit_pct(auth.uid(), h.id) end,
    case when h.id <> auth.uid() then public.you_fit_pct(auth.uid(), h.id) end
  from hits h
  order by h.score desc, h.last_seen_at desc
$$;


revoke execute on function public.lookup_players(text) from public, anon;
grant execute on function public.lookup_players(text) to authenticated;

-- 2. Mutual unfriend. The reverse delete fires this again, which finds nothing and stops.
create or replace function public.unfriend_both_ways()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friends where user_id = old.friend_id and friend_id = old.user_id;
  return old;
end
$$;

drop trigger if exists friends_unfriend_both_ways on public.friends;
create trigger friends_unfriend_both_ways after delete on public.friends
  for each row execute function public.unfriend_both_ways();

-- 3. Placeholders.
create table if not exists public.friend_placeholders (
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);
create unique index if not exists friend_placeholders_key_idx
  on public.friend_placeholders (user_id, public.search_key(name));

alter table public.friend_placeholders enable row level security;

revoke all on public.friend_placeholders from anon, authenticated;
grant select, insert, delete on public.friend_placeholders to authenticated;

drop policy if exists "own placeholders read" on public.friend_placeholders;
create policy "own placeholders read" on public.friend_placeholders
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own placeholders insert" on public.friend_placeholders;
create policy "own placeholders insert" on public.friend_placeholders
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own placeholders delete" on public.friend_placeholders;
create policy "own placeholders delete" on public.friend_placeholders
  for delete to authenticated using (user_id = (select auth.uid()));

-- As many as a full friend list.
create or replace function public.check_placeholder_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.friend_placeholders where user_id = new.user_id) >= public.max_friends() then
    raise exception 'placeholder_limit';
  end if;
  return new;
end
$$;

drop trigger if exists friend_placeholders_limit on public.friend_placeholders;
create trigger friend_placeholders_limit before insert on public.friend_placeholders
  for each row execute function public.check_placeholder_limit();

-- Adding a friend whose IGN matches a placeholder settles it.
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
    and public.search_key(fp.name) = public.search_key(pr.ign);
  return new;
end
$$;

drop trigger if exists friends_clear_placeholder on public.friends;
create trigger friends_clear_placeholder after insert on public.friends
  for each row execute function public.clear_friend_placeholder();

-- Your placeholders, oldest first, each with whether a player with that exact
-- IGN can be found here now (same rules as lookup: allow_lookup, no blocks).
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
        and public.search_key(pr.ign) = public.search_key(fp.name)
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
