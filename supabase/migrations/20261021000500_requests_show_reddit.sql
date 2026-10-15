-- A friend request also carries the sender's Reddit name (when they show it),
-- like their Discord name (20261021000400): player_extras returns it to the
-- player they asked while the request is open. Otherwise as 20261021000200.
-- Safe to re-run.

create or replace function public.player_extras(ids uuid[])
returns table (user_id uuid, game_avatar text, reddit_username text, votes_hidden boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.game_avatar,
    case when public.shows_discord(pr.id, pr.show_reddit)
           or (pr.show_reddit and exists (
                 select 1 from public.friend_requests r
                 where r.from_id = pr.id and r.to_id = auth.uid()
                   and r.status = 'open' and r.created_at > now() - public.request_ttl()))
         then pr.reddit_username end,
    not public.shows_votes(pr.id)
  from public.profiles pr
  where pr.id = any(ids[1:200])
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
         or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
    )
$$;
