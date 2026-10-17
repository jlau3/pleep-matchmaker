do $$
declare scored record;
begin
 assert not exists(
  (select * from seed_preserved except
   (select 'profile',to_jsonb(p) from public.profiles p
    union all select 'vote',to_jsonb(p) from public.preferences p
    union all select 'friend',to_jsonb(f) from public.friends f
    union all select 'request',to_jsonb(r) from public.friend_requests r))
 ),'real data, requests or original fixtures changed';
 assert not exists(select user_id from public.friends group by user_id having count(*)>50),'friend cap exceeded';
 assert not exists(select 1 from public.friends a where not exists(
  select 1 from public.friends b where b.user_id=a.friend_id and b.friend_id=a.user_id)),'asymmetric friends';
 assert not exists(select 1 from public.profiles where last_seen_at>now()),'future activity dates';
 assert (select count(*) from public.preferences where user_id='de000000-0000-4000-8000-000000000200')=1,'first-vote fixture';
 assert not exists(select 1 from public.preferences where user_id='de000000-0000-4000-8000-000000000013'),'no-vote fixture';
 select max(want_pct)-min(want_pct) spread,count(*) filter(where utility>0) positive,
 count(*) filter(where utility<=0) nonpositive,count(distinct friend_bin) bins
 into scored from public.trial_pair_scores('00000000-0000-4000-8000-000000000001',
 array(select id from public.profiles where id between 'de000000-0000-4000-8000-000000000141' and 'de000000-0000-4000-8000-000000000200'))
 where direction='you';
 assert scored.spread>30,format('not enough score variation: %s',scored.spread);
 assert scored.positive>0 and scored.nonpositive>0,'no positive/nonpositive contrast';
 assert scored.bins=3,'missing friend-data bin';
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 assert exists(select 1 from public.browse_all() where good),'no Recommended candidates';
 assert exists(select 1 from public.browse_all() where not good),'All players adds no candidates';
 raise notice 'Seed score spread: %, positive: %, nonpositive: %',scored.spread,scored.positive,scored.nonpositive;
end $$;
