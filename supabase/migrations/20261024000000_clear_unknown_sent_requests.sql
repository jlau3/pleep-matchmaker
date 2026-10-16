-- One-time cleanup of requests whose recipient renders as "Unknown player".
-- Keep accounts/votes and recognizable IGN or shared Discord names. Back up
-- only removed request rows in a table unavailable to API users.
create table if not exists public.removed_unknown_requests (
  request jsonb not null,
  removed_at timestamptz not null default now()
);
alter table public.removed_unknown_requests enable row level security;
revoke all on public.removed_unknown_requests from public, anon, authenticated;
with removed as (
  delete from public.friend_requests r
  using public.profiles p
  where p.id = r.to_id
    and nullif(btrim(p.ign), '') is null
    and (not coalesce(p.show_discord, false) or (
      nullif(btrim(p.discord_username), '') is null
      and nullif(btrim(p.discord_display_name), '') is null
    ))
    and not exists (select 1 from public.friends f where f.user_id = r.from_id and f.friend_id = r.to_id)
  returning r.*
)
insert into public.removed_unknown_requests(request) select to_jsonb(removed) from removed;
