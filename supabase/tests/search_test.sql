\set ON_ERROR_STOP on

-- Accents, mixed case and spacing in display names and IGNs.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0009-000000000001', '{"name":"MixedCase_User#0","custom_claims":{"global_name":"Jäcky Ünicode"}}'),
  ('00000000-0000-0000-0009-000000000002', '{"name":"searcher#0"}');
update public.profiles set ign = 'SnorLAX  Fan' where id = '00000000-0000-0000-0009-000000000001';

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
  assert not exists (select 1 from public.lookup_players('snorlax')), 'still no partial matches';
  assert not exists (select 1 from public.lookup_players('jacky unicode')), 'accents are not stripped';
end $$;

\echo 'ALL SEARCH TESTS PASSED'
