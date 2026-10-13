-- Linking Discord to an account (e.g. a Google sign-up), or unlinking it.
-- The Discord name, display name and avatar come from the linked Discord
-- identity itself (auth.identities), never from what a player types, so
-- nobody can claim someone else's Discord name. The app calls this after the
-- link sign-in comes back and after an unlink. Safe to re-run.
--
-- Linking for the first time turns "Show my Discord name" on (that's why
-- they linked it); later syncs keep the player's choice. With no Discord
-- identity left, the Discord fields are cleared and the toggle goes off.

create or replace function public.sync_discord_identity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d jsonb;
begin
  if me is null then
    return;
  end if;
  select i.identity_data into d
  from auth.identities i
  where i.user_id = me and i.provider = 'discord'
  order by i.updated_at desc
  limit 1;

  if d is null then
    update public.profiles
    set discord_id = null, discord_username = null, discord_display_name = null, avatar_url = null, show_discord = false
    where id = me and discord_id is not null;
    return;
  end if;

  update public.profiles
  set
    show_discord = case when discord_id is null then true else show_discord end,
    discord_id = coalesce(d ->> 'provider_id', d ->> 'sub'),
    discord_username = nullif(split_part(coalesce(d ->> 'name', d ->> 'full_name', ''), '#', 1), ''),
    discord_display_name = coalesce(d -> 'custom_claims' ->> 'global_name', d ->> 'full_name'),
    avatar_url = d ->> 'avatar_url'
  where id = me;
end;
$$;

revoke execute on function public.sync_discord_identity() from public, anon;
grant execute on function public.sync_discord_identity() to authenticated;
