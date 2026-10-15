-- Cards say when a player's votes are friends-only. Their match %s still use
-- their real votes (server side), but their lists come back empty to
-- non-friends, so "You'd send them 0 they want" read as a fact. player_extras
-- now also returns votes_hidden (not shows_votes). Safe to re-run.

drop function if exists public.player_extras(uuid[]);

create function public.player_extras(ids uuid[])
returns table (user_id uuid, game_avatar text, reddit_username text, votes_hidden boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.game_avatar, pr.reddit_username, not public.shows_votes(pr.id)
  from public.profiles pr
  where pr.id = any(ids[1:200])
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
         or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
    )
$$;

revoke execute on function public.player_extras(uuid[]) from public, anon;
grant execute on function public.player_extras(uuid[]) to authenticated;
