-- "Added you" on My Friends shows both fit numbers, like the rest of the page,
-- so you can judge whether to add them back. The banner on other pages calls
-- get_added_me() without them (with_fit defaults to false) so it stays cheap.
-- Safe to re-run.

drop function if exists public.get_added_me();
drop function if exists public.get_added_me(boolean);

create function public.get_added_me(with_fit boolean default false)
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
    f.created_at,
    case when with_fit then public.fit_pct(auth.uid(), pr.id) end,
    case when with_fit then public.you_fit_pct(auth.uid(), pr.id) end
  from public.friends f
  join public.profiles pr on pr.id = f.user_id
  where f.friend_id = auth.uid()
    and pr.allow_lookup
    and not exists (select 1 from public.friends mine where mine.user_id = auth.uid() and mine.friend_id = f.user_id)
    and not exists (select 1 from public.friend_prompt_dismissals d where d.user_id = auth.uid() and d.adder_id = f.user_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = f.user_id)
         or (b.blocker_id = f.user_id and b.blocked_id = auth.uid())
    )
  order by f.created_at desc
$$;

revoke execute on function public.get_added_me(boolean) from public, anon;
grant execute on function public.get_added_me(boolean) to authenticated;
