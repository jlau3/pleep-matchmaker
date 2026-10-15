-- Sent requests that lapse (30 days unanswered) stay on your list as
-- 'expired' until you send again or clear them, instead of quietly vanishing.
-- The request row was already kept; only this read changes. They still can't
-- be accepted, and drop off the other player's list as before. Safe to re-run.

create or replace function public.get_sent_requests()
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
  status text
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
    case when pr.open_to_friends then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    r.created_at,
    case when r.status = 'open' and r.created_at <= now() - public.request_ttl() then 'expired' else r.status end
  from public.friend_requests r
  join public.profiles pr on pr.id = r.to_id
  where r.from_id = auth.uid()
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.to_id)
         or (b.blocker_id = r.to_id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc
$$;
revoke execute on function public.get_sent_requests() from public, anon;
grant execute on function public.get_sent_requests() to authenticated;
