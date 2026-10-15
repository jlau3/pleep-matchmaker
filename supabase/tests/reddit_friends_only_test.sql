\set ON_ERROR_STOP on

-- 20261021000200_reddit_friends_only.sql: Reddit names show to friends (and
-- yourself) only, and not even to friends with show_reddit off.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0033-000000000001', '{"name":"rf_owner#0"}'),
  ('00000000-0000-0000-0033-000000000002', '{"name":"rf_stranger#0"}'),
  ('00000000-0000-0000-0033-000000000003', '{"name":"rf_friend#0"}');
update public.profiles set ign = 'RedditOwner', friend_code = '888800000001', reddit_username = 'snoo_napper'
where id = '00000000-0000-0000-0033-000000000001';
update public.profiles set ign = 'RfStranger', friend_code = '888800000002' where id = '00000000-0000-0000-0033-000000000002';
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0033-00000000000' || u)::uuid, l, 'want'::public.choice
from generate_series(1, 2) u, unnest(array['ra', 'rb', 'rc']) l;
select public.test_befriend('00000000-0000-0000-0033-000000000001', '00000000-0000-0000-0033-000000000003');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0033-000000000002', false);
do $$ begin
  assert exists (select 1 from public.player_extras(array['00000000-0000-0000-0033-000000000001'::uuid]) where reddit_username is null),
    'stranger: no Reddit name';
  assert exists (select 1 from public.browse_all() where user_id = '00000000-0000-0000-0033-000000000001' and reddit_username is null),
    'Find New: no Reddit name';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0033-000000000003', false);
do $$ begin
  assert (select reddit_username from public.player_extras(array['00000000-0000-0000-0033-000000000001'::uuid])) = 'snoo_napper', 'friend sees it';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0033-000000000001', false);
update public.profiles set show_reddit = false where id = auth.uid();
do $$ begin
  assert (select reddit_username from public.player_extras(array[auth.uid()])) is null, 'off: hidden from yourself on cards too';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0033-000000000003', false);
do $$ begin
  assert (select reddit_username from public.player_extras(array['00000000-0000-0000-0033-000000000001'::uuid])) is null, 'off: friends don''t see it';
end $$;
update public.profiles set show_reddit = true where id = '00000000-0000-0000-0033-000000000001';
reset role;
do $$ begin
  assert not (select show_reddit from public.profiles where id = '00000000-0000-0000-0033-000000000001'), 'others untouched';
end $$;

\echo 'ALL REDDIT FRIENDS ONLY TESTS PASSED'
