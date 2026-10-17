-- Expected candy fit trial. Demand is count-based Wants + k=5 global prior,
-- normalized to a sending distribution. Spotlight does not affect demand.
-- Private helpers are never callable by API roles. Client-side Recommended
-- filtering requires one eligibility bit PER ROW in All players. This accepted
-- disclosure reveals whether both utilities > 0, but never returns the hidden
-- other direction, its shares, its utility, lift, or ranking tie-breakers.

-- Preserve the existing global population, but retain integer counts so a
-- mathematically zero utility cannot turn positive through early rate division.
create or replace function public.trial_global_counts()
returns table(line_id text,wants numeric,voters numeric)
language sql stable security definer set search_path='' as $$
with active as materialized(
 select pr.id from public.profiles pr cross join public.match_config() cfg
 where pr.last_seen_at>now()-cfg.stale_after
 and exists(select 1 from public.preferences p where p.user_id=pr.id and p.choice='want')
)
select p.line_id,count(*)::numeric,(select count(*)::numeric from active)
from public.preferences p join active a on a.id=p.user_id where p.choice='want' group by p.line_id
$$;
revoke all on function public.trial_global_counts() from public,anon,authenticated;

create or replace function public.trial_pair_scores(viewer uuid, players uuid[])
returns table(candidate uuid, direction text, want_pct numeric, unwanted_pct numeric,
  utility numeric, baseline_utility numeric, lift numeric, friend_voters int, friend_bin text)
language sql stable security definer set search_path = '' as $$
with
ids as materialized (select distinct p.id from public.profiles p where p.id = any(players) and p.id <> viewer),
community as materialized (select * from public.trial_global_counts()),
pairs as (
  select i.id candidate, 'you'::text direction, viewer receiver, i.id sender,
    case when exists(select 1 from public.friends f where f.user_id=i.id and f.friend_id=viewer) then viewer end skip
  from ids i
  union all
  select i.id, 'them', i.id, viewer,
    case when exists(select 1 from public.friends f where f.user_id=viewer and f.friend_id=i.id) then i.id end
  from ids i
),
keyed as materialized (select p.*, p.sender::text || ':' || coalesce(p.skip::text,'') mix_key from pairs p),
targets as (select distinct mix_key,sender,skip from keyed),
wanted as materialized (select p.user_id,p.line_id from public.preferences p where p.choice='want'),
voting as materialized (select distinct user_id from public.preferences),
friend_voters as materialized (
 select t.mix_key,f.friend_id from targets t join public.friends f on f.user_id=t.sender
 where f.friend_id is distinct from t.skip and exists(select 1 from wanted w where w.user_id=f.friend_id)
),
counts as (select mix_key,count(*)::int n from friend_voters group by mix_key),
friend_wants as materialized (
 select f.mix_key,w.line_id,count(*)::numeric wants from friend_voters f join wanted w on w.user_id=f.friend_id
 group by f.mix_key,w.line_id
),
lines as (select line_id from community union select line_id from friend_wants),
strengths as (
 select t.mix_key,l.line_id,coalesce(w.wants,0)*coalesce((select max(voters) from community),1)+public.demand_prior_votes()*coalesce(c.wants,0) strength
 from targets t cross join lines l
 left join friend_wants w on w.mix_key=t.mix_key and w.line_id=l.line_id
 left join community c on c.line_id=l.line_id
),
mix as materialized (
 select s.mix_key,s.line_id,s.strength,sum(s.strength) over(partition by s.mix_key) total_strength,
  100*s.strength/sum(s.strength) over(partition by s.mix_key) share
 from strengths s where s.strength>0
),
measured as (
 select k.candidate,k.direction,k.receiver,coalesce(v.n,0)::int n,
   case when exists(select 1 from voting x where x.user_id=k.receiver) and count(m.line_id)>0
     then coalesce(sum(m.share) filter(where p.choice='want'),0) end w,
   case when exists(select 1 from voting x where x.user_id=k.receiver) and count(m.line_id)>0
     then coalesce(sum(m.share) filter(where p.choice='dont_want'),0) end d,
   case when exists(select 1 from voting x where x.user_id=k.receiver) and count(m.line_id)>0
     then 100*sum(m.strength*case p.choice when 'want' then 1 when 'dont_want' then -0.5 else 0 end)/max(m.total_strength) end net
 from keyed k left join mix m on m.mix_key=k.mix_key
 left join public.preferences p on p.user_id=k.receiver and p.line_id=m.line_id
 left join counts v on v.mix_key=k.mix_key
 group by k.candidate,k.direction,k.receiver,v.n
),
baselines as (
 select receivers.receiver,
 case when exists(select 1 from voting v where v.user_id=receivers.receiver) and sum(c.wants)>0 then
  100*coalesce(sum(c.wants*case p.choice when 'want' then 1 when 'dont_want' then -0.5 else 0 end),0)/sum(c.wants) end utility
 from (select distinct receiver from keyed) receivers cross join community c
 left join public.preferences p on p.user_id=receivers.receiver and p.line_id=c.line_id
 group by receivers.receiver
)
select m.candidate,m.direction,m.w,m.d,m.net,b.utility,m.net-b.utility,m.n,
 case when m.n=0 then '0' when m.n<5 then '1–4' else '5+' end
from measured m left join baselines b on b.receiver=m.receiver
$$;
revoke all on function public.trial_pair_scores(uuid,uuid[]) from public,anon,authenticated;

-- Preserve all existing eligibility rules. This private helper is reused by
-- suggestions and admin-only diagnostics; no caller can supply another viewer.
create or replace function public.trial_candidates(viewer uuid)
returns setof public.profiles language sql stable security definer set search_path = '' as $$
 select pr.* from public.profiles pr cross join public.match_config() cfg
 where public.social_profile_ready(viewer) and public.social_profile_ready(pr.id) and pr.id<>viewer
 and pr.open_to_friends and pr.ign is not null and pr.allow_lookup and pr.friend_code is not null
 and pr.last_seen_at>now()-cfg.stale_after
 and (select count(*) from public.friends f where f.user_id=pr.id)<public.max_friends()
 and not exists(select 1 from public.friends f where f.user_id=viewer and f.friend_id=pr.id)
 and not exists(select 1 from public.blocks b where (b.blocker_id=viewer and b.blocked_id=pr.id) or (b.blocker_id=pr.id and b.blocked_id=viewer))
 and not exists(select 1 from public.inactive_reports x where x.player_id=pr.id and x.created_at>pr.last_seen_at and x.reporter_id=viewer)
 and (select count(*) from public.inactive_reports x where x.player_id=pr.id and x.created_at>pr.last_seen_at)<public.inactive_reports_to_hide()
$$;
revoke all on function public.trial_candidates(uuid) from public,anon,authenticated;

drop function public.browse_players(text,boolean,integer,integer,integer);
drop function public.browse_all();
create function public.browse_all()
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,
 last_seen_at timestamptz,prefs_updated_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric,you_voted boolean,
 list_voters int,good boolean,game_avatar text,reddit_username text,votes_hidden boolean)
language sql stable security definer set search_path = '' as $$
with candidates as materialized(select * from public.trial_candidates(auth.uid())),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select id from candidates)))
select c.id,
 case when public.shows_discord(c.id,c.show_discord) then c.discord_username end,
 case when public.shows_discord(c.id,c.show_discord) then c.discord_display_name end,
 case when public.shows_discord(c.id,c.show_discord) then c.avatar_url end,
 c.ign,null::text,c.last_seen_at,c.prefs_updated_at,u.want_pct,u.unwanted_pct,u.utility,(select exists(select 1 from public.preferences p where p.user_id=auth.uid())),u.friend_voters,
 coalesce(u.utility>0 and t.utility>0,false),c.game_avatar,
 case when public.shows_discord(c.id,c.show_reddit) then c.reddit_username end,not public.shows_votes(c.id)
from candidates c left join scores u on u.candidate=c.id and u.direction='you'
left join scores t on t.candidate=c.id and t.direction='them'
-- No hidden-direction tie breaker: the eligibility bit is the only accepted disclosure.
order by u.utility desc nulls last,c.last_seen_at desc,c.id limit 1000
$$;
revoke all on function public.browse_all() from public,anon;
grant execute on function public.browse_all() to authenticated;

create function public.browse_players(sort text default 'you_fit',everyone boolean default false,
 page_size int default 20,page_offset int default 0,line_count int default 0)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,
 last_seen_at timestamptz,prefs_updated_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric,you_voted boolean,
 list_voters int,good boolean,game_avatar text,reddit_username text,votes_hidden boolean,total_count bigint)
language sql stable security definer set search_path = '' as $$
with all_rows as materialized(select * from public.browse_all()),
listed as materialized(select * from all_rows where everyone or good),
spotlight as (
 select t.user_id,sum(case t.tier when 'S' then 4 when 'A' then 3 when 'B' then 2 when 'C' then 1 else 0 end) score
 from public.top3_tiers_set(array(select l.user_id from listed l),auth.uid(),line_count) t where sort='top3' group by t.user_id
)
select l.*,count(*) over() from listed l left join spotlight t on t.user_id=l.user_id
order by case when sort='active' then l.last_seen_at end desc nulls last,
 case when sort='top3' then t.score end desc nulls last,l.you_utility desc nulls last,l.last_seen_at desc,l.user_id
limit least(greatest(page_size,1),50) offset greatest(page_offset,0)
$$;
revoke all on function public.browse_players(text,boolean,integer,integer,integer) from public,anon;
grant execute on function public.browse_players(text,boolean,integer,integer,integer) to authenticated;

-- Keep identity/contact and privacy decisions from the established functions,
-- but move their old implementations behind private contact-only helpers.
do $migration$
declare definition text;
begin
 if to_regprocedure('public.trial_friend_contacts(boolean)') is null then
  alter function public.get_friends(boolean) rename to trial_friend_contacts;
 end if;
 if to_regprocedure('public.trial_request_contacts(boolean)') is null then
  alter function public.get_friend_requests(boolean) rename to trial_request_contacts;
 end if;
 if to_regprocedure('public.trial_lookup_contacts(text)') is null then
  alter function public.lookup_players(text) rename to trial_lookup_contacts;
  definition:=pg_get_functiondef('public.trial_lookup_contacts(text)'::regprocedure);
  if position('public.fit_pct(auth.uid(), h.id)' in definition)=0 or position('public.you_fit_pct(auth.uid(), h.id)' in definition)=0 then
   raise exception 'lookup query shape changed';
  end if;
  definition:=replace(definition,'public.fit_pct(auth.uid(), h.id)','null::int');
  definition:=replace(definition,'public.you_fit_pct(auth.uid(), h.id)','null::int');
  execute definition;
 end if;
end $migration$;
revoke all on function public.trial_friend_contacts(boolean) from public,anon,authenticated;
revoke all on function public.trial_request_contacts(boolean) from public,anon,authenticated;
revoke all on function public.trial_lookup_contacts(text) from public,anon,authenticated;

create or replace function public.get_friends(with_match boolean default true)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,last_seen_at timestamptz,prefs_updated_at timestamptz,added_at timestamptz,visible boolean,wants text[],dont_wants text[],top_wants text[],
 match_pct numeric,you_fit_pct numeric,added_me boolean,they_unwanted_pct numeric,you_unwanted_pct numeric,they_utility numeric,you_utility numeric)
language sql stable security definer set search_path = '' as $$
with contacts as materialized(select * from public.trial_friend_contacts(false)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select user_id from contacts where with_match)))
select c.user_id,c.discord_username,c.discord_display_name,c.avatar_url,c.ign,c.friend_code,c.last_seen_at,c.prefs_updated_at,c.added_at,c.visible,c.wants,c.dont_wants,c.top_wants,
 t.want_pct,u.want_pct,c.added_me,t.unwanted_pct,u.unwanted_pct,t.utility,u.utility
from contacts c left join scores u on u.candidate=c.user_id and u.direction='you'
left join scores t on t.candidate=c.user_id and t.direction='them'
order by c.added_at
$$;
revoke all on function public.get_friends(boolean) from public,anon;
grant execute on function public.get_friends(boolean) to authenticated;

create or replace function public.get_friend_requests(with_fit boolean default false)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,last_seen_at timestamptz,prefs_updated_at timestamptz,requested_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric)
language sql stable security definer set search_path = '' as $$
with contacts as materialized(select * from public.trial_request_contacts(false)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select user_id from contacts where with_fit)))
select c.user_id,c.discord_username,c.discord_display_name,c.avatar_url,c.ign,c.friend_code,c.last_seen_at,c.prefs_updated_at,c.requested_at,u.want_pct,u.unwanted_pct,u.utility
from contacts c left join scores u on u.candidate=c.user_id and u.direction='you' order by c.requested_at desc
$$;
revoke all on function public.get_friend_requests(boolean) from public,anon;
grant execute on function public.get_friend_requests(boolean) to authenticated;

create or replace function public.lookup_players(q text)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,last_seen_at timestamptz,prefs_updated_at timestamptz,wants text[],dont_wants text[],top_wants text[],match_pct numeric,you_fit_pct numeric,
 they_unwanted_pct numeric,you_unwanted_pct numeric,they_utility numeric,you_utility numeric)
language sql stable security definer set search_path = '' as $$
with contacts as materialized(select * from public.trial_lookup_contacts(q)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select user_id from contacts)))
select c.user_id,c.discord_username,c.discord_display_name,c.avatar_url,c.ign,c.friend_code,c.last_seen_at,c.prefs_updated_at,c.wants,c.dont_wants,c.top_wants,
 case when public.shows_votes(c.user_id) then t.want_pct end,u.want_pct,
 case when public.shows_votes(c.user_id) then t.unwanted_pct end,u.unwanted_pct,
 case when public.shows_votes(c.user_id) then t.utility end,u.utility
from contacts c left join scores u on u.candidate=c.user_id and u.direction='you'
left join scores t on t.candidate=c.user_id and t.direction='them'
$$;
revoke all on function public.lookup_players(text) from public,anon;
grant execute on function public.lookup_players(text) to authenticated;

create or replace function public.group_demand_from_rates(viewer uuid,skip uuid,rates jsonb)
returns table(line_id text,share numeric) language sql stable security definer set search_path='' as $$
with friend_wants as (
 select p.line_id,count(*)::numeric wants from public.friends f join public.preferences p on p.user_id=f.friend_id and p.choice='want'
 where f.user_id=viewer and f.friend_id is distinct from skip group by p.line_id
), c as(select key line_id,value::numeric rate from jsonb_each_text(rates)),
blend as(select coalesce(f.line_id,c.line_id) line_id,coalesce(f.wants,0)+public.demand_prior_votes()*coalesce(c.rate,0) d
from friend_wants f full join c on c.line_id=f.line_id)
select line_id,d/sum(d) over() from blend where d>0
$$;
create or replace function public.group_demand(viewer uuid,skip uuid default null)
returns table(line_id text,share numeric) language sql stable security definer set search_path='' as $$
 select * from public.group_demand_from_rates(viewer,skip,(select coalesce(jsonb_object_agg(line_id,rate),'{}'::jsonb) from public.community_want_rate()))
$$;
create or replace function public.fit_pct_from_rates(viewer uuid,player uuid,rates jsonb)
returns int language sql stable security definer set search_path='' as $$
with d as materialized(select * from public.group_demand_from_rates(viewer,player,rates))
select case when exists(select 1 from public.preferences where user_id=player) and exists(select 1 from d)
 then round(100*coalesce(sum(d.share) filter(where p.choice='want'),0))::int end
from d left join public.preferences p on p.user_id=player and p.line_id=d.line_id
$$;
create or replace function public.you_fit_pct_from_rates(viewer uuid,player uuid,rates jsonb)
returns int language sql stable security definer set search_path='' as $$
with d as materialized(select * from public.group_demand_from_rates(player,viewer,rates))
select case when exists(select 1 from public.preferences where user_id=viewer) and exists(select 1 from d)
 then round(100*coalesce(sum(d.share) filter(where p.choice='want'),0))::int end
from d left join public.preferences p on p.user_id=viewer and p.line_id=d.line_id
$$;
create or replace function public.fit_pct(viewer uuid,player uuid)
returns int language sql stable security definer set search_path='' as $$
 select round(want_pct)::int from public.trial_pair_scores(viewer,array[player]) where direction='them'
$$;
create or replace function public.you_fit_pct(viewer uuid,player uuid)
returns int language sql stable security definer set search_path='' as $$
 select round(want_pct)::int from public.trial_pair_scores(viewer,array[player]) where direction='you'
$$;

-- A saved Neutral is still a saved vote: it yields 0% Want, not a dash.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.player_extras(uuid[])'::regprocedure);
 definition:=replace(definition,'where p.choice <> ''undecided''','');
 execute definition;
end $migration$;

-- Admin-only, on-demand diagnostics: no telemetry table or per-request writes.
-- Bins count friends with >=1 Want actually feeding each estimate, excluding
-- the receiver. At n=5 the prior and friend counts have equal pre-normalization
-- weight; their shares of normalized total demand need not be exactly 50/50.
create or replace function public.match_trial_diagnostics(viewers uuid[])
returns table(direction text,friend_bin text,pairs bigint,scored bigint,recommended bigint,
 utility_mean numeric,utility_p10 double precision,utility_p50 double precision,utility_p90 double precision,
 unwanted_mean numeric,lift_mean numeric,lift_p50 double precision)
language sql stable security definer set search_path='' as $$
with sample as materialized(
 select distinct p.id from public.profiles p where p.id=any(viewers[1:200])
), stats as materialized(
 select v.id viewer,s.* from sample v cross join lateral public.trial_pair_scores(v.id,
 array(select c.id from public.trial_candidates(v.id) c order by c.id limit 1000)) s
), eligible as(select viewer,candidate,bool_and(coalesce(utility>0,false)) good from stats group by viewer,candidate)
select s.direction,s.friend_bin,count(*),count(s.utility),count(*) filter(where e.good),avg(s.utility),
 percentile_cont(0.1) within group(order by s.utility::double precision),
 percentile_cont(0.5) within group(order by s.utility::double precision),
 percentile_cont(0.9) within group(order by s.utility::double precision),avg(s.unwanted_pct),avg(s.lift),
 percentile_cont(0.5) within group(order by s.lift::double precision)
from stats s join eligible e using(viewer,candidate) group by s.direction,s.friend_bin
$$;
revoke all on function public.match_trial_diagnostics(uuid[]) from public,anon,authenticated;

create or replace function public.my_friends_voted()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.friends f join public.preferences p on p.user_id=f.friend_id and p.choice='want' where f.user_id=auth.uid())
$$;
revoke all on function public.my_friends_voted() from public,anon;
grant execute on function public.my_friends_voted() to authenticated;

-- Publish the changed RPC result contracts atomically at transaction commit.
notify pgrst, 'reload schema';

-- These bounded interactive batches are cheaper interpreted: local 2k-player
-- EXPLAIN measured ~1.1s of JIT compilation alone. Scope this to the batch
-- functions, not the database, so larger unrelated queries keep their policy.
alter function public.trial_pair_scores(uuid,uuid[]) set jit = off;
alter function public.browse_all() set jit = off;
alter function public.get_friends(boolean) set jit = off;
