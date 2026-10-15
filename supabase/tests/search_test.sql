\set ON_ERROR_STOP on

-- Accents, mixed case and spacing in display names and IGNs.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0009-000000000001', '{"name":"MixedCase_User#0","custom_claims":{"global_name":"Jäcky Ünicode"}}'),
  ('00000000-0000-0000-0009-000000000002', '{"name":"searcher#0"}');
update public.profiles set ign = 'SnorLAX  Fan' where id = '00000000-0000-0000-0009-000000000001';
-- Discord names are friends-only (20261020001100_discord_friends_only.sql): a
-- stranger finds MixedCase_User by IGN only; a friend by Discord name too.
-- Searching needs your own IGN (20261021000300_search_needs_ign.sql).
update public.profiles set ign = coalesce(ign, 'ZzSearcher002'), friend_code = coalesce(friend_code, '420009002000') where id = '00000000-0000-0000-0009-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0009-000000000002', false);
do $$ begin
  assert (select count(*) from public.lookup_players('snorlax fan')) = 1, 'stranger: by IGN';
  assert not exists (select 1 from public.lookup_players('mixedcase_user')), 'stranger: not by Discord name';
  assert (select discord_username from public.lookup_players('snorlax fan')) is null, 'stranger: no Discord name shown';
end $$;
reset role;
select public.test_befriend('00000000-0000-0000-0009-000000000001', '00000000-0000-0000-0009-000000000002');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0009-000000000002', false);
do $$
declare q text;
begin
  foreach q in array array[
    'mixedcase_user', 'MIXEDCASE_USER', '@MixedCase_user',
    'jäcky ünicode', 'JÄCKY ÜNICODE', 'Jäcky  Ünicode',
    'snorlax fan', 'SNORLAX FAN', ' snorlax   fan ', 'ＳＮＯＲＬＡＸ fan',
    -- "ä" typed as a + combining diaeresis
    E'ja\u0308cky \u00fcnicode'
  ] loop
    assert (select count(*) from public.lookup_players(q)) = 1, format('no hit for %L', q);
  end loop;
end $$;

-- Close names (20261017000200_fuzzy_search.sql): partial names and typos, from 3
-- characters, at most 10 results, best first; hidden Discord names stay hidden.
reset role;
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0009-' || lpad(to_hex(10 + g), 12, '0'))::uuid, format('{"name":"fz_sleeper_%s#0"}', g)::jsonb
from generate_series(1, 12) g;
update public.profiles set ign = discord_username where id::text like '00000000-0000-0000-0009-0000000000%' and discord_username like 'fz_sleeper_%';
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0009-000000000003', '{"name":"hidden_dragonite#0"}');
update public.profiles set show_discord = false, ign = 'Quiet One' where discord_username = 'hidden_dragonite';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0009-000000000002', false);
do $$
declare first_id uuid;
begin
  -- Exact names only since 20261021001100_exact_search.sql: no partial names or typos.
  assert not exists (select 1 from public.lookup_players('snorlax') where user_id = '00000000-0000-0000-0009-000000000001'),
    'partial IGN: no';
  assert not exists (select 1 from public.lookup_players('snorlx fan') where user_id = '00000000-0000-0000-0009-000000000001'),
    'typo in IGN: no';
  assert not exists (select 1 from public.lookup_players('mixedcase') where user_id = '00000000-0000-0000-0009-000000000001'),
    'partial Discord name: no';
  assert not exists (select 1 from public.lookup_players('sn') where user_id = '00000000-0000-0000-0009-000000000001'),
    'two letters: exact only';
  assert not exists (select 1 from public.lookup_players('qqqqzz')), 'nothing close';
  assert not exists (select 1 from public.lookup_players('fz_sleeper')), 'a shared prefix finds nobody';
  assert (select count(*) from public.lookup_players('fz_sleeper_7')) = 1, 'only the exact name';
  -- The exact name comes first.
  select user_id into first_id from public.lookup_players('fz_sleeper_7') limit 1;
  assert first_id = '00000000-0000-0000-0009-000000000011', format('exact first, got %s', first_id);
  -- A hidden Discord name can't be found, not even roughly; their IGN still can.
  assert not exists (select 1 from public.lookup_players('hidden_dragonite')), 'hidden name, exact';
  assert not exists (select 1 from public.lookup_players('dragonite')), 'hidden name, partial';
  assert exists (select 1 from public.lookup_players('quiet one')), 'IGN still works';
  -- You only find yourself by exact name.
  assert not exists (select 1 from public.lookup_players('searche') where user_id = auth.uid()), 'self not fuzzy';
end $$;

\echo 'ALL SEARCH TESTS PASSED'
