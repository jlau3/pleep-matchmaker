\set ON_ERROR_STOP on

-- 20261018000000_tighter_fuzzy_search.sql: substring matches, typos only from 5 characters.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0017-000000000001', '{"name":"ts_me#0"}'),
  ('00000000-0000-0000-0017-000000000002', '{"name":"ts_two#0"}'),
  ('00000000-0000-0000-0017-000000000003', '{"name":"ts_three#0"}'),
  ('00000000-0000-0000-0017-000000000004', '{"name":"ts_m#0"}'),
  ('00000000-0000-0000-0017-000000000005', '{"name":"ts_mo#0"}'),
  ('00000000-0000-0000-0017-000000000006', '{"name":"ts_molli#0"}'),
  ('00000000-0000-0000-0017-000000000007', '{"name":"ts_mah#0"}');
update public.profiles set ign = 'Mr Time' where id = '00000000-0000-0000-0017-000000000002';
update public.profiles set ign = 'Snorlax_Lover' where id = '00000000-0000-0000-0017-000000000003';
update public.profiles set ign = 'M' where id = '00000000-0000-0000-0017-000000000004';
update public.profiles set ign = 'Mo' where id = '00000000-0000-0000-0017-000000000005';
update public.profiles set ign = 'Molli' where id = '00000000-0000-0000-0017-000000000006';
update public.profiles set ign = 'Mah' where id = '00000000-0000-0000-0017-000000000007';

-- Searching needs your own IGN (20261021000300_search_needs_ign.sql).
update public.profiles set ign = coalesce(ign, 'ZzSearcher001'), friend_code = coalesce(friend_code, '420017001000') where id = '00000000-0000-0000-0017-000000000001';
-- Existing social fixtures include a chosen icon.
update public.profiles set game_avatar = coalesce(game_avatar, 'pikachu:normal') where id::text like any (array['00000000-0000-0000-0017-%']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0017-000000000001', false);
do $$
declare
  t constant uuid := '00000000-0000-0000-0017-000000000002';
  s constant uuid := '00000000-0000-0000-0017-000000000003';
begin
  assert not exists (select 1 from public.lookup_players('mrl') where user_id = t), 'mrl is not Mr Time';
  -- Exact names only since 20261021001100_exact_search.sql.
  assert not exists (select 1 from public.lookup_players('tim') where user_id = t), 'word start: no';
  assert exists (select 1 from public.lookup_players('mrtime') where user_id = t), 'spaces ignored';
  assert not exists (select 1 from public.lookup_players('r ti') where user_id = t), 'substring: no';
  assert not exists (select 1 from public.lookup_players('lax lov') where user_id = s), 'substring across _: no';
  assert not exists (select 1 from public.lookup_players('snorlx') where user_id = s), 'typo: no';
  assert not exists (select 1 from public.lookup_players('snrl') where user_id = s), 'no typos under 5 characters';
  -- 20261018000100_one_letter_names.sql: exact names at any length, nothing looser below 3.
  assert (select array_agg(ign) from public.lookup_players('m')) = '{M}', 'one letter: only the exact name';
  assert (select array_agg(ign) from public.lookup_players('MO')) = '{Mo}', 'two letters: only the exact name';
  assert not exists (select 1 from public.lookup_players('mol')), 'three letters: still exact only';
end $$;
reset role;

\echo 'ALL TIGHTER SEARCH TESTS PASSED'
