\set ON_ERROR_STOP on

-- 20261021000100_hide_code.sql: with share_code off, strangers who find you
-- (Find New, IGN search) don't get your friend code; typing it, a request
-- from you, or being friends still shows it.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0032-000000000001', '{"name":"hc_hider#0"}'),
  ('00000000-0000-0000-0032-000000000002', '{"name":"hc_viewer#0"}'),
  ('00000000-0000-0000-0032-000000000003', '{"name":"hc_sharer#0"}');
update public.profiles set ign = 'HiddenCode', friend_code = '777700000001', share_code = false where id = '00000000-0000-0000-0032-000000000001';
update public.profiles set ign = 'HcViewer', friend_code = '777700000002' where id = '00000000-0000-0000-0032-000000000002';
update public.profiles set ign = 'HcSharer', friend_code = '777700000003' where id = '00000000-0000-0000-0032-000000000003';
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0032-00000000000' || u)::uuid, l, 'want'::public.choice
from generate_series(1, 3) u, unnest(array['ha', 'hb', 'hc']) l;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0032-000000000002', false);
do $$
declare r record;
begin
  select * into r from public.lookup_players('HiddenCode');
  assert found and r.friend_code is null, 'IGN search: no code';
  select * into r from public.lookup_players('7777 0000 0001');
  assert found and r.friend_code = '777700000001', 'typed code: shown';
  select * into r from public.browse_all() where user_id = '00000000-0000-0000-0032-000000000001';
  assert found and r.friend_code is null, 'Find New: no code';
  select * into r from public.browse_all() where user_id = '00000000-0000-0000-0032-000000000003';
  assert found and r.friend_code = '777700000003', 'sharing player keeps their code';
  assert not exists (select 1 from public.browse_players('fit', false, 50, 0)
                     where user_id = '00000000-0000-0000-0032-000000000001' and friend_code is not null), 'paged Find New: no code';
  assert not exists (select 1 from public.get_matches()
                     where user_id = '00000000-0000-0000-0032-000000000001' and friend_code is not null), 'matches: no code';
  assert public.send_friend_request('00000000-0000-0000-0032-000000000001') = 'sent';
  assert (select friend_code from public.get_sent_requests() where user_id = '00000000-0000-0000-0032-000000000001') is null,
    'sent request: still no code';
end $$;

-- The hider's own request carries their code to the other side.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0032-000000000001', false);
do $$ begin
  assert public.send_friend_request('00000000-0000-0000-0032-000000000003') = 'sent';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0032-000000000003', false);
do $$ begin
  assert (select friend_code from public.get_friend_requests() where user_id = '00000000-0000-0000-0032-000000000001') = '777700000001',
    'incoming request shows the requester''s code';
end $$;

-- Friends see it.
reset role;
select public.test_befriend('00000000-0000-0000-0032-000000000002', '00000000-0000-0000-0032-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0032-000000000002', false);
do $$ begin
  assert (select friend_code from public.get_friends() where user_id = '00000000-0000-0000-0032-000000000001') = '777700000001', 'friend sees code';
  assert (select friend_code from public.lookup_players('HiddenCode')) = '777700000001', 'friend sees code in search';
end $$;

-- Players can't flip someone else's setting.
update public.profiles set share_code = true where id = '00000000-0000-0000-0032-000000000001';
reset role;
do $$ begin
  assert not (select share_code from public.profiles where id = '00000000-0000-0000-0032-000000000001'), 'others untouched';
end $$;

\echo 'ALL HIDE CODE TESTS PASSED'
