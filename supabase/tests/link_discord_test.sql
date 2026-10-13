\set ON_ERROR_STOP on

-- sync_discord_identity: a Google account gains its Discord name only from a
-- linked Discord identity, shows it by default, keeps a later choice, and
-- loses it again when Discord is unlinked.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0011-000000000001', '{"iss":"https://accounts.google.com","name":"Goo Gle"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0011-000000000001', false);
do $$ begin
  perform public.sync_discord_identity();
  assert (select discord_username from public.profiles where id = auth.uid()) is null, 'no Discord yet';
end $$;
reset role;

insert into auth.identities (user_id, provider, identity_data) values
  ('00000000-0000-0000-0011-000000000001', 'discord',
   '{"provider_id":"4242","name":"linkedgoo#0","full_name":"Linked Goo","avatar_url":"https://cdn/x.png","custom_claims":{"global_name":"Linked Goo"}}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0011-000000000001', false);
do $$ begin
  perform public.sync_discord_identity();
  assert (select discord_username from public.profiles where id = auth.uid()) = 'linkedgoo', 'name from identity';
  assert (select discord_id from public.profiles where id = auth.uid()) = '4242', 'id from identity';
  assert (select show_discord from public.profiles where id = auth.uid()), 'shown on first link';
end $$;
-- Players still can't write Discord fields themselves.
do $$ begin
  begin
    update public.profiles set discord_username = 'someoneelse' where id = auth.uid();
    assert false, 'discord_username should not be writable';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.profiles set show_discord = false where id = auth.uid();
do $$ begin
  perform public.sync_discord_identity();
  assert not (select show_discord from public.profiles where id = auth.uid()), 'later sync keeps the choice';
end $$;
reset role;

delete from auth.identities where user_id = '00000000-0000-0000-0011-000000000001' and provider = 'discord';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0011-000000000001', false);
do $$ begin
  perform public.sync_discord_identity();
  assert (select discord_username from public.profiles where id = auth.uid()) is null, 'cleared on unlink';
  assert not (select show_discord from public.profiles where id = auth.uid()), 'hidden on unlink';
end $$;
reset role;

\echo 'ALL LINK DISCORD TESTS PASSED'
