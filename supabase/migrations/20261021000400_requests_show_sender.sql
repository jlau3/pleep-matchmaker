-- A friend request introduces the sender: the player they asked sees their
-- IGN, icon and friend code (as before) and now also their Discord name and
-- picture when they show it at all (show_discord), not only to friends.
-- Otherwise a sender with no IGN or icon (e.g. requests from before IGNs were
-- required) showed as "Unknown player" with no picture. Blocks still hide the
-- request. Only get_friend_requests changes. Safe to re-run.

create or replace function public.get_friend_requests(with_fit boolean default false)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  requested_at timestamptz,
  match_pct int,
  you_fit_pct int
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
    pr.ign,
    pr.friend_code,
    pr.last_seen_at,
    pr.prefs_updated_at,
    r.created_at,
    case when with_fit then public.fit_pct(auth.uid(), pr.id) end,
    case when with_fit then public.you_fit_pct(auth.uid(), pr.id) end
  from public.friend_requests r
  join public.profiles pr on pr.id = r.from_id
  where r.to_id = auth.uid()
    and r.status = 'open'
    and r.created_at > now() - public.request_ttl()
    and not exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = r.from_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.from_id)
         or (b.blocker_id = r.from_id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc
$$;
