#!/usr/bin/env python3
"""Print an incremental DEV-only refresh of synthetic vote/friend communities.

Keeps real accounts, profiles, votes, friends and requests. Keeps the original
20 named seed fixtures intact. Reuses fake IDs 21–140 as demand donors and
141–200 as discoverable candidates, anchored to up to three recent dev testers.
Run through the guarded Dev database workflow; never include this in migrations.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFIX = "de000000-0000-4000-8000-"
lines = json.loads((ROOT / "src/data/candy-lines.json").read_text())
avatars = sorted(json.loads((ROOT / "src/data/avatars.json").read_text()))

def q(value):
    return "'" + str(value).replace("'", "''") + "'"

line_values = ",\n".join(f"({i}, {q(line['id'])}, { {'foongus': 5, 'mewtwo': 50}.get(line['id'], 100)})" for i, line in enumerate(lines))
icon_values = ",\n".join(f"({g}, {q(avatars[g % len(avatars)] + ':normal')})" for g in range(21, 201))

print(f"""-- Incremental, deterministic synthetic data refresh. DEV ONLY.
-- Caller must execute this whole file in ONE transaction with ON_ERROR_STOP.
do $guard$ begin
  if to_regprocedure('public.dev_player(text)') is null
     or to_regclass('public.dev_applied_migrations') is null
     or to_regprocedure('public.trial_pair_scores(uuid,uuid[])') is null then
    raise exception 'Refusing match seed: this is not an initialized dev trial database';
  end if;
  if (select count(*) from auth.users where id::text not like '{PREFIX}%') > 10 then
    raise exception 'Refusing match seed: too many non-fixture accounts';
  end if;
  if (select count(*) from auth.users where id between '{PREFIX}000000000021' and '{PREFIX}000000000200') <> 180 then
    raise exception 'Refusing match seed: install the original 200-player dev seed first';
  end if;
end $guard$;

-- Real vote data is read only to make useful test cases. No real data is written.
create temp table match_seed_viewers on commit drop as
select id, row_number() over(order by last_seen_at desc,id)::int n from (
 select pr.id,pr.last_seen_at from public.profiles pr
 where pr.id::text not like '{PREFIX}%'
 and exists(select 1 from public.preferences p where p.user_id=pr.id)
 order by pr.last_seen_at desc,pr.id limit 3
) recent;
create temp table match_seed_lines(n int,line_id text,coverage int) on commit drop;
insert into match_seed_lines values {line_values};
create temp table match_seed_icons(g int,icon text) on commit drop;
insert into match_seed_icons values {icon_values};
create temp table match_seed_players on commit drop as
select ('{PREFIX}'||lpad(g::text,12,'0'))::uuid id,g,
 case when g<141 then (g-21)/40 else (g-141)%6 end family,
 case when g<141 then null else (array[0,2,10,40])[1+((g-141)/6)%4] end degree,
 (select v.id from match_seed_viewers v where v.n=1+(case when g<141 then (g-21)%40 else (g-141)/6 end)%greatest((select count(*)::int from match_seed_viewers),1)) viewer
from generate_series(21,200) g;

-- Remove only managed-fake to managed-fake edges. Real connections/requests and
-- edges to the original 20 named fixtures are preserved in both directions.
delete from public.friends f using match_seed_players a,match_seed_players b
where f.user_id=a.id and f.friend_id=b.id;

update public.profiles pr set allow_lookup=true,open_to_friends=(s.g>=141),
 friend_code=coalesce(pr.friend_code,'9000'||lpad(s.g::text,8,'0')),game_avatar=i.icon,
 ign=case
  when s.g=197 then 'Broad Wishlist Bea' when s.g=198 then 'Picky Parker'
  when s.g=199 then 'Neutral Nell' when s.g=200 then 'First Vote Finn'
  when s.g>=141 then (array['Wanted Mix','Unwanted Mix','Neutral Mix','Balanced Mix','Want Lean','Unwanted Lean'])[1+s.family]||' '||lpad(((s.g-141)/6+1)::text,2,'0')
  else 'Candy Helper '||lpad(s.g::text,3,'0') end,
 setup_done=true
from match_seed_players s join match_seed_icons i using(g) where pr.id=s.id;

delete from public.preferences p using match_seed_players s where p.user_id=s.id;
with categorized as (
 select s.*,l.line_id,l.n,
 coalesce((select p.choice::text from public.preferences p where p.user_id=s.viewer and p.line_id=l.line_id),
  case when s.viewer is not null then 'undecided' else (array['want','dont_want','undecided'])[1+l.n%3] end) category,
 get_byte(decode(md5(s.g::text||':'||l.line_id),'hex'),0) roll
 from match_seed_players s cross join match_seed_lines l
 where (s.g<>200 or l.n=0) and (s.g+l.n)%100<l.coverage
), available as (
 select c.*,count(*) filter(where category=(array['want','dont_want','undecided'])[1+family]) over(partition by id) category_size
 from categorized c
), votes as (
 select id,line_id,case
  when g<141 then case
    when category=(array['want','dont_want','undecided'])[1+family] or (category_size=0 and n%3=family)
      then case when roll<235 then 'want' when roll<242 then 'dont_want' else 'undecided' end
    else case when roll<7 then 'want' when roll<60+(g%9)*6 then 'dont_want' else 'undecided' end end
  when g=197 then 'want' when g=198 then 'dont_want' when g=199 then 'undecided' when g=200 then 'want'
  when (g-141)/12=0 then case when roll<175+(g%7)*5 then 'want' when roll<218 then 'dont_want' else 'undecided' end
  when (g-141)/12=1 then case when roll<8+(g%5)*3 then 'want' when roll<150+(g%7)*5 then 'dont_want' else 'undecided' end
  when (g-141)/12=2 then case when roll<80+(g%8)*4 then 'want' when roll<160+(g%6)*4 then 'dont_want' else 'undecided' end
  when (g-141)/12=3 then case when roll<220 then category when roll<238 then 'want' else 'dont_want' end
  else case when roll>230 then 'want' when roll>215 then 'dont_want' else case category when 'want' then 'dont_want' when 'dont_want' then 'want' else 'undecided' end end
 end::public.choice choice from available
)
insert into public.preferences(user_id,line_id,choice) select id,line_id,choice from votes;

-- At most three Spotlight selections, always on Want votes; deterministic.
update public.preferences p set top=true from (
 select p.user_id,p.line_id,s.g,row_number() over(partition by p.user_id order by md5(p.line_id||s.g::text)) rank
 from public.preferences p join match_seed_players s on s.id=p.user_id
 where s.g>=141 and p.choice='want'
) stars where p.user_id=stars.user_id and p.line_id=stars.line_id and stars.rank<=stars.g%4;

-- Coherent sender communities: 0/2/10/40 donor friends, with real/fixture
-- connections still present. Respect the cap on BOTH ends of every edge.
do $graph$
declare c record; donor record; added int; donor_family int;
begin
 for c in select * from match_seed_players where g>=141 order by g loop
  added:=0;
  for donor in select * from match_seed_players where g<141
    order by (viewer is not distinct from c.viewer) desc,(g+c.g)%40,g loop
   exit when added>=c.degree;
   donor_family:=case when c.family<3 then c.family
      when c.family=3 then added%3
      when c.family=4 then case when added%4<3 then 0 else 1 end
      else case when added%4<3 then 1 else 0 end end;
   if donor.family<>donor_family then continue; end if;
   if (select count(*) from public.friends where user_id=c.id)>=public.max_friends() then exit; end if;
   if (select count(*) from public.friends where user_id=donor.id)>=public.max_friends() then continue; end if;
   insert into public.friends(user_id,friend_id) values(c.id,donor.id),(donor.id,c.id) on conflict do nothing;
   added:=added+1;
  end loop;
 end loop;
end $graph$;

-- Distinct activity dates make Recently Active visibly different from fit order.
update public.profiles pr set last_seen_at=now()-((s.g-21)%12)*interval '2 days'-s.g*interval '1 minute',
 prefs_updated_at=now()-((s.g-21)%7)*interval '1 day'
from match_seed_players s where pr.id=s.id;

-- Refuse a homogenized refresh: all 200 synthetic vote profiles must differ.
-- Missing saved rows are significant (newcomers differ from Neutral-only voters).
do $unique$ begin
 if exists(
  select signature from (
   select pr.id,coalesce(string_agg(p.line_id||':'||p.choice::text,',' order by p.line_id),'no saved votes') signature
   from public.profiles pr left join public.preferences p on p.user_id=pr.id
   where pr.id::text like '{PREFIX}%' group by pr.id
  ) signatures group by signature having count(*)>1
 ) then raise exception 'Synthetic vote profiles are not unique; refresh rolled back'; end if;
end $unique$;

-- Aggregate-only result: no real names, codes or individual votes in job logs.
select count(*) as refreshed_fake_players from match_seed_players;
select s.family,count(*) as candidates,
 min((select count(*) from public.friends f where f.user_id=s.id)) as min_friends,
 max((select count(*) from public.friends f where f.user_id=s.id)) as max_friends
from match_seed_players s where s.g>=141 group by s.family order by s.family;
select v.n as tester,s.direction,min(s.want_pct)::numeric(6,1) as min_want,
 max(s.want_pct)::numeric(6,1) as max_want,max(s.unwanted_pct)::numeric(6,1) as max_unwanted,
 count(*) filter(where s.utility<=0) as nonpositive,count(*) filter(where s.utility>0) as positive
from match_seed_viewers v cross join lateral public.trial_pair_scores(v.id,
 array(select id from match_seed_players where g>=141)) s
group by v.n,s.direction order by v.n,s.direction;
""")
