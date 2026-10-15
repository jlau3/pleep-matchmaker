\set ON_ERROR_STOP on

-- 20261018000200_strong_name_match.sql: Not here yet ignores spaces, separators and decorations.
do $$ begin
  -- Same cases as src/lib/names.test.ts, so the app and the database agree.
  assert public.strong_name_key('★Mr_Time★') = 'mrtime', 'decorations and separators';
  assert public.strong_name_key('Ｍｒ　Ｔｉｍｅ') = 'mrtime', 'full-width';
  assert public.strong_name_key('ゆき・だるま') = 'ゆきだるま', 'Japanese, middle dot dropped';
  assert public.strong_name_key('ユーキ') = 'ユーキ', 'long vowel mark kept';
  assert public.strong_name_key('★★') = '★★', 'all-symbol name kept';
  assert public.strong_name_key('☆ ☆') = '★★', 'lookalike stars folded';
  assert public.strong_name_key('❤️') = '♥', 'emoji variation selector dropped';
  assert public.strong_name_key('♡') = '♥', 'lookalike hearts folded';
  assert public.strong_name_key('♪') = '♪', 'notes are not stars';
end $$;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0018-000000000001', '{"name":"sn_me#0"}'),
  ('00000000-0000-0000-0018-000000000002', '{"name":"sn_time#0"}'),
  ('00000000-0000-0000-0018-000000000003', '{"name":"sn_star#0"}');
update public.profiles set ign = 'Mr Time' where id = '00000000-0000-0000-0018-000000000002';
update public.profiles set ign = '★' where id = '00000000-0000-0000-0018-000000000003';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0018-000000000001', false);
insert into public.friend_placeholders (user_id, name) values (auth.uid(), '★mr_time'), (auth.uid(), 'Mr Tme'), (auth.uid(), '☆');
do $$ begin
  assert (select signed_up from public.get_friend_placeholders() where name = '☆'), 'lone symbol, lookalike';
  assert exists (select 1 from public.lookup_players('☆') where ign = '★'), 'search finds a lone symbol by its lookalike';
  assert not exists (select 1 from public.lookup_players('♪') where ign = '★'), 'but not a different symbol';
  assert (select signed_up from public.get_friend_placeholders() where name = '★mr_time'), 'same name, different separators';
  assert not (select signed_up from public.get_friend_placeholders() where name = 'Mr Tme'), 'a typo is not a strong match';
end $$;
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0018-000000000002');
do $$ begin
  assert (select array_agg(name order by name) from public.get_friend_placeholders()) = '{"Mr Tme",☆}', 'adding them cleared only the strong match';
end $$;
reset role;

\echo 'ALL STRONG NAME TESTS PASSED'
