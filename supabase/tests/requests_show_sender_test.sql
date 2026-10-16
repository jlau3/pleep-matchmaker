\set ON_ERROR_STOP on

-- 20261021000400_requests_show_sender.sql: the player you ask sees your
-- Discord name and picture (if you show it), plus IGN and code; a stranger
-- searching still doesn't, and a block hides the request.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0035-000000000001', '{"iss":"https://discord.com/api","provider_id":"351","name":"rq_sender#0","custom_claims":{"global_name":"Sender"},"avatar_url":"https://cdn.discordapp.com/rq.png"}'),
  ('00000000-0000-0000-0035-000000000002', '{"name":"rq_target#0"}'),
  ('00000000-0000-0000-0035-000000000003', '{"name":"rq_other#0"}');
update public.profiles set ign = 'RqSender', friend_code = '555500000001', reddit_username = 'rq_snoo' where id = '00000000-0000-0000-0035-000000000001';
update public.profiles set ign = 'RqOther', friend_code = '555500000003' where id = '00000000-0000-0000-0035-000000000003';

-- Existing social fixtures include a chosen icon.
update public.profiles set game_avatar = coalesce(game_avatar, 'pikachu:normal') where id::text like any (array['00000000-0000-0000-0035-%']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0035-000000000001', false);
do $$ begin assert public.send_friend_request('00000000-0000-0000-0035-000000000002') = 'sent'; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0035-000000000002', false);
do $$
declare r record;
begin
  select * into r from public.get_friend_requests() where user_id = '00000000-0000-0000-0035-000000000001';
  assert found, 'request listed';
  assert r.ign = 'RqSender' and r.friend_code = '555500000001', 'IGN and code';
  assert r.discord_username = 'rq_sender' and r.avatar_url = 'https://cdn.discordapp.com/rq.png', 'Discord name and picture';
  assert (select reddit_username from public.player_extras(array['00000000-0000-0000-0035-000000000001'::uuid])) = 'rq_snoo', 'Reddit name (20261021000500)';
end $$;

-- The sender sees who they asked by Discord name too (20261021000600).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0035-000000000003', false);
do $$ begin assert public.send_friend_request('00000000-0000-0000-0035-000000000001') in ('sent', 'friends'); end $$;
do $$ begin
  assert (select discord_username from public.get_sent_requests() where user_id = '00000000-0000-0000-0035-000000000001') = 'rq_sender',
    'sent request: Discord name of who you asked';
end $$;

-- A stranger still doesn't see the Discord name.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0035-000000000003', false);
do $$ begin
  assert (select discord_username from public.lookup_players('RqSender')) is null, 'stranger: no Discord name';
  assert (select reddit_username from public.player_extras(array['00000000-0000-0000-0035-000000000001'::uuid])) is null, 'stranger: no Reddit name';
end $$;

-- Hidden Discord stays hidden, even on a request.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0035-000000000001', false);
update public.profiles set show_discord = false where id = auth.uid();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0035-000000000002', false);
do $$ begin
  assert (select discord_username from public.get_friend_requests() where user_id = '00000000-0000-0000-0035-000000000001') is null, 'hidden Discord stays hidden';
end $$;

-- Blocking hides the request.
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0035-000000000001');
do $$ begin
  assert not exists (select 1 from public.get_friend_requests() where user_id = '00000000-0000-0000-0035-000000000001'), 'blocked: gone';
end $$;
reset role;

\echo 'ALL REQUESTS SHOW SENDER TESTS PASSED'
