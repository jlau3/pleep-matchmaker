-- "Show my Discord name": players can hide their Discord name and avatar
-- from everyone else. Hidden, they show (and are found) by IGN and friend
-- code only. On by default for anyone who signs up with Discord (existing
-- Discord accounts included); Google and email accounts have no Discord name
-- and stay off. Players change it in Profile > Settings. Safe to re-run.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'show_discord'
  ) then
    alter table public.profiles add column show_discord boolean not null default false;
    update public.profiles set show_discord = true where discord_username is not null;
  end if;
end $$;

grant update (show_discord) on public.profiles to authenticated;

-- Discord sign-ups start with it on (see 20261013000100 for the rest).
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- Discord's claims carry iss https://discord.com/api and Google's
  -- https://accounts.google.com. Email sign-ups have no iss, name or
  -- provider_id. Metadata without iss but with a name or provider_id (older
  -- rows, test fixtures) is treated as Discord, as before.
  is_discord boolean := case
    when meta ? 'iss' then meta ->> 'iss' like '%discord.com%'
    else meta ? 'provider_id' or meta ? 'name'
  end;
begin
  if not is_discord then
    insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
    return new;
  end if;

  -- Signing up with Discord shows the Discord name by default (show_discord
  -- true on insert only; a later login never flips the player's choice).
  insert into public.profiles (id, discord_id, discord_username, discord_display_name, avatar_url, show_discord)
  values (
    new.id,
    meta ->> 'provider_id',
    split_part(coalesce(meta ->> 'name', meta ->> 'full_name', ''), '#', 1),
    coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name'),
    meta ->> 'avatar_url',
    true
  )
  on conflict (id) do update set
    discord_id = excluded.discord_id,
    discord_username = excluded.discord_username,
    discord_display_name = excluded.discord_display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;


create or replace function public.get_matches()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  match_pct int,
  fit_wants text[],
  fit_dont_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  me as (select auth.uid() as id),
  g as (select * from public.group_demand((select id from me))),
  -- Prune: a match needs min_shared_wants wants your friends want too.
  sharers as (
    select p.user_id
    from public.preferences p
    join g on g.line_id = p.line_id
    cross join cfg
    where p.choice = 'want' and p.user_id <> (select id from me)
    group by p.user_id, cfg.min_shared_wants
    having count(*) >= cfg.min_shared_wants
  ),
  candidates as (
    select pr.*
    from public.profiles pr
    join sharers s on s.user_id = pr.id
    cross join cfg
    where pr.open_to_friends
      and pr.friend_code is not null
      and pr.last_seen_at > now() - cfg.stale_after
      and (select count(*) from public.friends f where f.user_id = pr.id) < public.max_friends()
      and not exists (select 1 from public.friends f where f.user_id = (select id from me) and f.friend_id = pr.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
      and not exists (
        select 1 from public.inactive_reports r
        where r.player_id = pr.id and r.created_at > pr.last_seen_at and r.reporter_id = (select id from me)
      )
      and (
        select count(*) from public.inactive_reports r
        where r.player_id = pr.id and r.created_at > pr.last_seen_at
      ) < public.inactive_reports_to_hide()
  ),
  agg as (
    select
      p.user_id,
      coalesce(sum(coalesce(g.share, 0)) filter (where p.choice = 'want'), 0) as hit,
      count(*) filter (where p.choice = 'want')
        + public.dont_want_weight() * coalesce(sum(g.share) filter (where p.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'want' and g.share is not null), '{}') as fit_wants,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'dont_want' and g.share is not null), '{}') as fit_dont_wants
    from public.preferences p
    join candidates c on c.id = p.user_id
    left join g on g.line_id = p.line_id
    where p.choice <> 'undecided'
    group by p.user_id
  )
  select
    c.id,
    case when c.show_discord then c.discord_username end,
    case when c.show_discord then c.discord_display_name end,
    case when c.show_discord then c.avatar_url end,
    c.ign,
    c.friend_code,
    c.last_seen_at,
    c.prefs_updated_at,
    round(100.0 * a.hit / a.total)::int as match_pct,
    a.fit_wants,
    a.fit_dont_wants
  from agg a
  join candidates c on c.id = a.user_id
  cross join cfg
  where a.total > 0 and 100.0 * a.hit / a.total >= cfg.min_pct
  order by match_pct desc, cardinality(a.fit_wants) desc, c.last_seen_at desc
  limit 100
$$;

create or replace function public.get_friends(with_match boolean default true)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  added_at timestamptz,
  visible boolean,
  wants text[],
  dont_wants text[],
  top_wants text[],
  match_pct int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    case when pr.show_discord then pr.discord_username end,
    case when pr.show_discord then pr.discord_display_name end,
    case when pr.show_discord then pr.avatar_url end,
    case when pr.allow_lookup then pr.ign end,
    case when pr.allow_lookup then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    f.created_at,
    pr.allow_lookup,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.top), '{}') else '{}' end,
    case when with_match and pr.allow_lookup then public.fit_pct(auth.uid(), pr.id) end
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

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
  match_pct int
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
  hits as (
    select pr.*
    from public.profiles pr, needle n
    where pr.allow_lookup
      and char_length(n.text_q) >= 2
      and (
        (pr.show_discord and public.search_key(pr.discord_username) = n.text_q)
        or (pr.show_discord and public.search_key(pr.discord_display_name) = n.text_q)
        or public.search_key(pr.ign) = n.text_q
        or (char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q)
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
    limit 20
  )
  select
    h.id,
    case when h.show_discord then h.discord_username end,
    case when h.show_discord then h.discord_display_name end,
    case when h.show_discord then h.avatar_url end,
    h.ign,
    h.friend_code,
    h.last_seen_at,
    h.prefs_updated_at,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.top), '{}'),
    case when h.id <> auth.uid() then public.fit_pct(auth.uid(), h.id) end
  from hits h
  order by h.last_seen_at desc
$$;


-- Blocked list: same masking, plus the IGN so hidden and non-Discord players
-- still have a name.
drop function if exists public.get_blocked();

create function public.get_blocked()
returns table (user_id uuid, discord_username text, discord_display_name text, ign text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    case when pr.show_discord then pr.discord_username end,
    case when pr.show_discord then pr.discord_display_name end,
    pr.ign,
    b.created_at
  from public.blocks b
  join public.profiles pr on pr.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

revoke execute on function public.get_blocked() from public, anon;
grant execute on function public.get_blocked() to authenticated;
