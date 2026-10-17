\set ON_ERROR_STOP on

-- 20261021000300_search_needs_ign.sql: no IGN of your own, no search results.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0034-000000000001', '{"name":"sni_target#0"}'),
  ('00000000-0000-0000-0034-000000000002', '{"name":"sni_noign#0"}');
update public.profiles set ign = 'FindableNapper', friend_code = '666600000001' where id = '00000000-0000-0000-0034-000000000001';

-- Existing social fixtures include a chosen icon.
update public.profiles set game_avatar = coalesce(game_avatar, 'pikachu:normal') where id::text like any (array['00000000-0000-0000-0034-%']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0034-000000000002', false);
do $$ begin
  assert not exists (select 1 from public.lookup_players('FindableNapper')), 'no IGN: not by IGN';
  assert not exists (select 1 from public.lookup_players('6666 0000 0001')), 'no IGN: not by code';
end $$;
update public.profiles set ign = 'SniSearcher' where id = auth.uid();
do $$ begin
  assert not exists (select 1 from public.lookup_players('FindableNapper')), 'IGN but no code: still nothing (20261021000700)';
end $$;
update public.profiles set friend_code = '666600000002' where id = auth.uid();
do $$ begin
  assert exists (select 1 from public.lookup_players('FindableNapper')), 'with an IGN: found';
end $$;
reset role;

\echo 'ALL SEARCH NEEDS IGN TESTS PASSED'
