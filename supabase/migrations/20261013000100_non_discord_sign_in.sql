-- Google and email (magic link) sign-in. Profiles used to copy name, avatar
-- and id from whatever account signed in, which would publish a Google
-- user's real name and photo as their "Discord name". Now only Discord
-- metadata fills the discord_* fields and avatar_url; anyone else gets a
-- profile with those left empty and is known by their IGN. A Google or email
-- sign-in on an account that also has Discord leaves the Discord fields as
-- they were. Safe to re-run.

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

  insert into public.profiles (id, discord_id, discord_username, discord_display_name, avatar_url)
  values (
    new.id,
    meta ->> 'provider_id',
    split_part(coalesce(meta ->> 'name', meta ->> 'full_name', ''), '#', 1),
    coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name'),
    meta ->> 'avatar_url'
  )
  on conflict (id) do update set
    discord_id = excluded.discord_id,
    discord_username = excluded.discord_username,
    discord_display_name = excluded.discord_display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;
