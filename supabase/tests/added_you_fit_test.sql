\set ON_ERROR_STOP on

-- me wants a,b,c; ann added me. Ann has no friends voting, so her list is the
-- community, which here wants exactly a,b,c: 100% for me.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0012-000000000001', '{"name":"af_me#0"}'),
  ('00000000-0000-0000-0012-000000000002', '{"name":"af_ann#0"}');
insert into public.friends (user_id, friend_id) values
  ('00000000-0000-0000-0012-000000000002', '00000000-0000-0000-0012-000000000001');
insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-0012-000000000001', '00000000-0000-0000-0012-000000000002']) u,
     unnest(array['afa', 'afb', 'afc']) l;

delete from public.community_rates;
insert into public.community_rates (line_id, rate) values ('afa', 0.5), ('afb', 0.5), ('afc', 0.5);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0012-000000000001', false);
do $$ begin
  assert (select you_fit_pct from public.get_added_me(true) where discord_username = 'af_ann') = 100,
    format('you fit: %s', (select you_fit_pct from public.get_added_me(true)));
  -- The banner's call skips the numbers.
  assert (select you_fit_pct is null and match_pct is null from public.get_added_me() where discord_username = 'af_ann'),
    'no fit by default';
end $$;
reset role;
delete from public.community_rates;

\echo 'ALL ADDED YOU FIT TESTS PASSED'
