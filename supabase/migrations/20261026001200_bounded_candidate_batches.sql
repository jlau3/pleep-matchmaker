-- Preserve the one accepted Mutual Fit eligibility bit; no hidden-direction
-- shares, utility or ordering escape. Each ID-cursor batch is selected BEFORE
-- scoring, not after rescoring the whole community. Coarse filter flags share
-- this query's snapshot and existing caller eligibility/privacy/block rules.
create or replace function public.browse_candidate_batch(after_id uuid default null, batch_size int default 500)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,
 last_seen_at timestamptz,prefs_updated_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric,you_voted boolean,
 list_voters int,good boolean,game_avatar text,reddit_username text,votes_hidden boolean,is_new boolean,has_declined boolean)
language sql stable security definer set search_path = '' as $$
with candidates as materialized(select * from public.trial_candidates(auth.uid()) c where after_id is null or c.id>after_id order by c.id limit least(greatest(coalesce(batch_size,500),1),500)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select id from candidates)))
select c.id,
 case when public.shows_discord(c.id,c.show_discord) then c.discord_username end,
 case when public.shows_discord(c.id,c.show_discord) then c.discord_display_name end,
 case when public.shows_discord(c.id,c.show_discord) then c.avatar_url end,
 c.ign,null::text,c.last_seen_at,c.prefs_updated_at,u.want_pct,u.unwanted_pct,u.utility,(select exists(select 1 from public.preferences p where p.user_id=auth.uid())),u.friend_voters,
 coalesce(u.utility>0 and t.utility>0,false),c.game_avatar,
 case when public.shows_discord(c.id,c.show_reddit) then c.reddit_username end,not public.shows_votes(c.id),c.created_at>=now()-interval '14 days',
 exists(select 1 from public.friend_requests r where r.status='declined' and
 ((r.from_id=auth.uid() and r.to_id=c.id) or (r.to_id=auth.uid() and r.from_id=c.id)))
from candidates c left join scores u on u.candidate=c.id and u.direction='you'
left join scores t on t.candidate=c.id and t.direction='them'
-- No hidden-direction tie breaker: the eligibility bit is the only accepted disclosure.
order by c.id
$$;
revoke all on function public.browse_candidate_batch(uuid,integer) from public,anon;
grant execute on function public.browse_candidate_batch(uuid,integer) to authenticated;


-- Legacy callers can still range/page the complete population.
create or replace function public.browse_all()
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
order by u.utility desc nulls last,c.last_seen_at desc,c.id
$$;
revoke all on function public.browse_all() from public,anon;
grant execute on function public.browse_all() to authenticated;


-- Preserve the measured interactive-query policy on both entry points.
alter function public.browse_candidate_batch(uuid,integer) set jit=off;
alter function public.browse_all() set jit=off;
notify pgrst, 'reload schema';
