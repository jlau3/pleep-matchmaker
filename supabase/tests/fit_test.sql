\set ON_ERROR_STOP on

-- Fit is measured against your friends' wants, not your own.
-- v (viewer) wants only zz. Friends: f1 wants fa (starred), fb; f2 wants fa, fc.
-- Stars don't count in fit. Group demand: fa 2, fb 1, fc 1 -> shares fa 1, fb 0.5, fc 0.5.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0005-000000000001', '{"name":"vee#0"}'),
  ('00000000-0000-0000-0005-000000000002', '{"name":"fone#0"}'),
  ('00000000-0000-0000-0005-000000000003', '{"name":"ftwo#0"}'),
  ('00000000-0000-0000-0005-000000000004', '{"name":"cone#0"}'),
  ('00000000-0000-0000-0005-000000000005', '{"name":"ctwo#0"}'),
  ('00000000-0000-0000-0005-000000000006', '{"name":"dub#0"}'),
  ('00000000-0000-0000-0005-000000000007', '{"name":"ex#0"}'),
  ('00000000-0000-0000-0005-000000000008', '{"name":"cthree#0"}'),
  ('00000000-0000-0000-0005-000000000009', '{"name":"cfour#0"}');
update public.profiles set friend_code = '5555' || right(id::text, 8) where id::text like '00000000-0000-0000-0005-%';

insert into public.preferences (user_id, line_id, choice, top) values
  ('00000000-0000-0000-0005-000000000001', 'zz', 'want', false),
  ('00000000-0000-0000-0005-000000000002', 'fa', 'want', true),
  ('00000000-0000-0000-0005-000000000002', 'fb', 'want', false),
  ('00000000-0000-0000-0005-000000000003', 'fa', 'want', false),
  ('00000000-0000-0000-0005-000000000003', 'fc', 'want', false),
  -- c1: fa, fb, fc and v's own zz -> (1 + 0.5 + 0.5 + 0) / 4 = 50%.
  ('00000000-0000-0000-0005-000000000004', 'fa', 'want', false),
  ('00000000-0000-0000-0005-000000000004', 'fb', 'want', false),
  ('00000000-0000-0000-0005-000000000004', 'fc', 'want', false),
  ('00000000-0000-0000-0005-000000000004', 'zz', 'want', false),
  ('00000000-0000-0000-0005-000000000004', 'fx', 'dont_want', false),
  -- c2: fa, fb, fc plus six lines nobody in the group wants -> 2 / 9 = 22%.
  ('00000000-0000-0000-0005-000000000005', 'fa', 'want', false),
  ('00000000-0000-0000-0005-000000000005', 'fb', 'want', false),
  ('00000000-0000-0000-0005-000000000005', 'fc', 'want', false);
-- c3: wants fb, fc, zz but doesn't want fa, the group's top line:
-- (0.5 + 0.5) / (3 + 1) = 25%. (c1's don't-want fx costs nothing: no one wants it.)
-- c4: wants only fc (f2's line) and zz -> 0.5 / 2 = 25%.
insert into public.preferences (user_id, line_id, choice) values
  ('00000000-0000-0000-0005-000000000009', 'fc', 'want'),
  ('00000000-0000-0000-0005-000000000009', 'zz', 'want'),
  ('00000000-0000-0000-0005-000000000008', 'fb', 'want'),
  ('00000000-0000-0000-0005-000000000008', 'fc', 'want'),
  ('00000000-0000-0000-0005-000000000008', 'zz', 'want'),
  ('00000000-0000-0000-0005-000000000008', 'fa', 'dont_want');
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0005-000000000005'::uuid, 'y' || g, 'want'::public.choice from generate_series(1, 6) g;

insert into public.friends (user_id, friend_id) values
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0005-000000000002'),
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0005-000000000003'),
  -- w (dub) has the same two friends, so c1 fits w at 50% too.
  ('00000000-0000-0000-0005-000000000006', '00000000-0000-0000-0005-000000000002'),
  ('00000000-0000-0000-0005-000000000006', '00000000-0000-0000-0005-000000000003');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000001', false);

do $$
declare r record;
begin
  select * into r from public.get_matches() where discord_username = 'cone';
  assert r.match_pct = 50, format('c1 fit %s', r.match_pct);
  assert r.fit_wants = '{fa,fb,fc}', format('fit wants ordered by demand %s', r.fit_wants);
  assert not exists (select 1 from public.get_matches() where discord_username = 'ctwo'), 'c2 below min_pct';
  -- Easygoing cap: the group's list sends fa 1 + fb 0.5 + fc 0.5 = 2 lines' worth,
  -- so c2's 9 wants count as 2. c2 wants everything the list sends: 2 / 2.
  assert (select match_pct from public.lookup_players('ctwo')) = 100, 'easygoing player not marked down';
  -- c3: (0.5 + 0.5) / (least(3, 2) + 1) = 33%.
  assert (select match_pct from public.lookup_players('cthree')) = 33, 'don''t-want on a top line costs a want';
  -- Each friend is compared with the rest of the list:
  -- f1 (fa, fb) vs f2 (fa, fc): 1 / 2 = 50%, f1's star on fa adds nothing;
  -- f2 (fa, fc) vs f1 (fa, fb): 1 / 2 = 50%.
  assert (select match_pct from public.get_friends() where discord_username = 'fone') = 50, 'f1 fit, star ignored';
  assert (select match_pct from public.get_friends() where discord_username = 'ftwo') = 50, 'f2 fit';
end $$;

-- A friend with a private list doesn't count toward the group: with f2 hidden,
-- fc (only f2 wants it) drops out, so c4 goes from 25% to 0%.
reset role;
update public.profiles set allow_lookup = false where discord_username = 'ftwo';
set role authenticated;
do $$ begin
  assert (select match_pct from public.lookup_players('cfour')) = 0,
    format('hidden friend excluded %s', (select match_pct from public.lookup_players('cfour')));
end $$;
reset role;
update public.profiles set allow_lookup = true where discord_username = 'ftwo';
set role authenticated;

-- Inactive reports: yours hide them from your Find New right away.
select public.report_inactive('00000000-0000-0000-0005-000000000004');
do $$ begin
  assert not exists (select 1 from public.get_matches() where discord_username = 'cone'), 'hidden after my report';
  assert (select count(*) from public.inactive_reports) = 1, 'own report readable';
end $$;

-- One or two reports don't hide them from others; three do.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000006', false);
do $$ begin
  assert (select match_pct from public.get_matches() where discord_username = 'cone') = 50, 'one report: still shown to others';
  assert (select count(*) from public.inactive_reports) = 0, 'others'' reports not readable';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000007', false);
select public.report_inactive('00000000-0000-0000-0005-000000000004');
select public.report_inactive(auth.uid()); -- reporting yourself is a no-op
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000006', false);
do $$ begin
  assert exists (select 1 from public.get_matches() where discord_username = 'cone'), 'two reports: still shown (20261020000200)';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000005', false);
select public.report_inactive('00000000-0000-0000-0005-000000000004');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000006', false);
do $$ begin
  assert not exists (select 1 from public.get_matches() where discord_username = 'cone'), 'three reports hide';
end $$;

-- Coming back clears it.
reset role;
update public.profiles set last_seen_at = now() + interval '1 second' where discord_username = 'cone';
set role authenticated;
do $$ begin
  assert exists (select 1 from public.get_matches() where discord_username = 'cone'), 'back after a visit';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0005-000000000001', false);
do $$ begin
  assert exists (select 1 from public.get_matches() where discord_username = 'cone'), 'my old report expired too';
end $$;

-- Reports can't be written directly.
do $$ begin
  begin
    insert into public.inactive_reports (reporter_id, player_id) values (auth.uid(), '00000000-0000-0000-0005-000000000005');
    assert false, 'direct insert should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo 'ALL FIT TESTS PASSED'
