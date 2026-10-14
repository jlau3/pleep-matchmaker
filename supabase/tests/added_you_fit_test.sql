\set ON_ERROR_STOP on

-- me wants a,b,c and my friend fay does too; ann wants a,b,c and added me.
-- "For them": ann's wants against my list (fay): 100%. "For you" needs 3 of
-- ann's friends voting; she has only me (left out), so it's a dash.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0012-000000000001', '{"name":"af_me#0"}'),
  ('00000000-0000-0000-0012-000000000002', '{"name":"af_ann#0"}'),
  ('00000000-0000-0000-0012-000000000003', '{"name":"af_fay#0"}');
insert into public.friends (user_id, friend_id) values
  ('00000000-0000-0000-0012-000000000002', '00000000-0000-0000-0012-000000000001'),
  ('00000000-0000-0000-0012-000000000001', '00000000-0000-0000-0012-000000000003');
insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-0012-000000000001', '00000000-0000-0000-0012-000000000002',
                  '00000000-0000-0000-0012-000000000003']) u,
     unnest(array['afa', 'afb', 'afc']) l;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0012-000000000001', false);
do $$ begin
  assert (select match_pct from public.get_added_me(true) where discord_username = 'af_ann') = 100,
    format('for them: %s', (select match_pct from public.get_added_me(true)));
  assert (select you_fit_pct from public.get_added_me(true) where discord_username = 'af_ann') is null,
    'for you: under 3 of her friends voting';
  -- The banner's call skips the numbers.
  assert (select you_fit_pct is null and match_pct is null from public.get_added_me() where discord_username = 'af_ann'),
    'no fit by default';
end $$;
reset role;

\echo 'ALL ADDED YOU FIT TESTS PASSED'
