#!/usr/bin/env python3
"""
Prints SQL that fills a DEV Supabase project with 200 fake players who look
like a real userbase: Discord, Google and email sign-ups; complete and
half-finished profiles; everyone / known / friends-only visibility; active,
drifting and long-gone players; different voting styles (thorough, casual,
want-everything, picky, type specialists, rare hunters, brand new); 0 to 3
stars; friend counts from none to a full list. The first 20 are fixed test
fixtures (search, privacy, fallbacks); the seed ends by listing them.

    python3 scripts/dev_seed.py > /tmp/dev_seed.sql

Paste the output into the dev project's SQL editor after the migrations. It
refuses to run on a database with more than 10 real accounts, so it can't land
on production by mistake. Running it again replaces the fake players. The
output is the same on every run (fixed random seed) apart from vote rolls.

Helpers for testing with your own dev account (YOUR_IGN is the IGN you set in
Profile on the preview):

    select public.dev_befriend('YOUR_IGN', 15);      -- 15 fake friends
    select public.dev_requests_to('YOUR_IGN', 6);    -- 6 incoming requests, mixed senders
    select public.dev_requests_from('YOUR_IGN', 4);  -- 4 sent requests, mixed recipients
    select public.dev_accept_sent('YOUR_IGN');       -- fake players accept your open sent requests
"""

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINES = json.loads((ROOT / "src" / "data" / "candy-lines.json").read_text())
AVATARS = sorted(json.loads((ROOT / "src" / "data" / "avatars.json").read_text()))
TYPES = sorted({line["type"] for line in LINES})
PLAYERS = 200
PREFIX = "de000000-0000-4000-8000-"
MAX_FRIENDS = 50
# Share of players who've opened My Votes since a line came out. The newest
# line stays under the public threshold (10 players) so "Not enough votes yet"
# has something to show.
UPTAKE = {"foongus": 0.05, "mewtwo": 0.5}

rng = random.Random(20261016)


def q(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def pick(weights: dict):
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def uid(g: int) -> str:
    return PREFIX + str(g).zfill(12)


# Fixtures: (ign, note, overrides). Anything not overridden is filled in below.
FIXTURES = [
    ("Spezy", "search 'spezy': only this player (exact match)", {}),
    ("Spooky Fren", "search 'spooky fren' / 'SPOOKYFREN': found; 'spezy' must not find it", {}),
    ("Mochi", "duplicate IGN #1: search 'mochi' shows two players", {"icon": "snorlax:normal"}),
    ("Mochi", "duplicate IGN #2", {"icon": "pikachu:shiny"}),
    ("HiddenHana", "friends-only: search must NOT find her", {"vis": "friends"}),
    ("KnownKoa", "known: search finds her, Find New doesn't", {"vis": "known"}),
    (None, "no IGN, Discord shown: appears as 'Dan'", {"kind": "discord", "d_user": "dconly_dan", "d_global": "Dan", "show_discord": True, "fc": None, "icon": None, "reddit": None}),
    (None, "no IGN, Discord hidden, Reddit shown to friends: u/sleepy_redditor", {"kind": "discord", "d_user": "quiet_one", "d_global": "Quiet", "show_discord": False, "fc": None, "icon": None, "reddit": "sleepy_redditor", "show_reddit": True}),
    (None, "no IGN, nothing shown: Unknown player + Unown icon", {"kind": "email", "fc": None, "icon": None, "reddit": None}),
    ("NoCodeNico", "IGN but no friend code", {"fc": None}),
    ("IconlessIris", "Google sign-up, no icon: Unown default", {"kind": "google", "icon": None}),
    ("GhostedGary", "last seen 90 days ago: hidden from matching", {"seen": 90.0}),
    ("NewbieNell", "joined today, no votes yet", {"style": "new", "seen": 0.01, "joined": 0.02, "stars": 0}),
    ("AllWantAl", "wants nearly everything", {"style": "hoarder"}),
    ("GrumpyGus", "mostly Don't Want", {"style": "picky", "stars": 1}),
    ("FireFanFaye", "fire specialist, 3 fire stars", {"style": "specialist", "fav": "fire", "stars": 3}),
    ("LegendLuca", "rare hunter: stars legendaries/pseudos", {"style": "rare", "stars": 3}),
    ("FullListFin", "50 friends: list full, dev_befriend skips him", {"degree": MAX_FRIENDS}),
    ("Pokémon★Zzz", "symbols in IGN", {}),
    ("すやすや", "Japanese IGN", {}),
]

WORDS = ["Mochi", "Snooze", "Pudding", "Dozer", "Komugi", "Nappy", "Cocoa", "Pillow", "Drowsy", "Biscuit", "Sora", "Yuki",
         "Luna", "Hazel", "Pip", "Momo", "Tofu", "Clover", "Sleepy", "Maple", "Kiwi", "Bean", "Nori", "Taro", "Juniper",
         "Zuzu", "Basil", "Pebble", "Mint", "Ollie", "Rin", "Haru", "Kai", "Nova", "Ember", "Willow", "Echo", "Fig"]
SUFFIX = ["", "", "", "Zzz", "Naps", "Bear", "Chan", "_", "99", "2", "TV", "Sleeps", "Kun", "Bun"]
NAME_STYLES = ["{w}{s}", "{w} {w2}", "{w}{n}", "{lw}_{lw2}", "xX{w}Xx", "{w}{s}"]


def gen_name() -> str:
    w, w2 = rng.sample(WORDS, 2)
    return rng.choice(NAME_STYLES).format(w=w, w2=w2, s=rng.choice(SUFFIX), n=rng.randint(1, 999), lw=w.lower(), lw2=w2.lower())


codes: set[str] = set()


def friend_code() -> str:
    while (code := "".join(rng.choice("0123456789") for _ in range(12))) in codes or code[0] == "0":
        pass
    codes.add(code)
    return code


def person(g: int) -> dict:
    fixture = FIXTURES[g - 1] if g <= len(FIXTURES) else None
    o = fixture[2] if fixture else {}
    kind = o.get("kind", pick({"discord": 60, "google": 30, "email": 10}))
    name = fixture[0] if fixture else gen_name()
    has_ign = bool(fixture and fixture[0]) if fixture else rng.random() < 0.92
    # Fixtures are active and visible to everyone unless they say otherwise.
    seen = o.get("seen", 0.1 + rng.random() * 3 if fixture else pick({0.2: 25, 4.0: 35, 18.0: 25, 45.0: 8, 120.0: 7}) * (0.3 + rng.random()))
    style = o.get("style", "thorough" if fixture else pick({"thorough": 35, "casual": 25, "new": 8, "hoarder": 7, "picky": 8, "specialist": 10, "rare": 7}))
    joined = o.get("joined", seen + (rng.random() * 3 if style == "new" else 5 + rng.random() * 200))
    d_user = o.get("d_user", (name or gen_name()).lower().replace(" ", "_").encode("ascii", "ignore").decode()[:28] or f"user{g}")
    reddit = o.get("reddit", d_user.replace(".", "_")[:20].ljust(3, "z") if rng.random() < 0.25 else None)
    return {
        "g": g,
        "kind": kind,
        "d_user": d_user if kind == "discord" else None,
        "d_global": o.get("d_global", name or d_user.title()) if kind == "discord" else None,
        "d_avatar": f"https://cdn.discordapp.com/embed/avatars/{g % 6}.png" if kind == "discord" and rng.random() < 0.85 else None,
        "show_discord": o.get("show_discord", rng.random() < 0.55) if kind == "discord" else False,
        "ign": name if has_ign else None,
        "fc": o["fc"] if "fc" in o else (friend_code() if has_ign and rng.random() < 0.95 else None),
        "icon": o["icon"] if "icon" in o else (
            rng.choice(AVATARS) + ":" + pick({"normal": 80, "shiny": 10, "happy": 7, "happy_shiny": 3}) if rng.random() < 0.8 else None),
        "reddit": reddit,
        "show_reddit": o.get("show_reddit", rng.random() < 0.7) if reddit else False,
        "vis": o.get("vis", "everyone" if fixture else pick({"everyone": 60, "known": 25, "friends": 15})),
        "seen": round(seen, 3),
        "joined": round(joined, 3),
        "style": style,
        "fav": o.get("fav", rng.choice(TYPES)),
        "lean": round(0.6 + 0.8 * rng.random(), 3),
        "stars": o.get("stars", 0 if style == "new" else pick({0: 30, 1: 12, 2: 13, 3: 45})),
        "degree": o.get("degree", 0 if style == "new" else min(MAX_FRIENDS - 5, int(rng.paretovariate(1.6) * 4) - 2)),
        "note": fixture[1] if fixture else None,
    }


people = [person(g) for g in range(1, PLAYERS + 1)]
# A few more full lists so "list full" isn't a one-off.
for p in rng.sample(people[len(FIXTURES):], 4):
    p["degree"] = MAX_FRIENDS

# Friendships: mostly inside six loose communities, never over the cap.
friends: set[tuple[int, int]] = set()
count = {p["g"]: 0 for p in people}
for p in sorted(people, key=lambda p: -p["degree"]):
    others = [o for o in people if o["g"] != p["g"] and o["degree"] > 0]
    rng.shuffle(others)
    others.sort(key=lambda o: (o["g"] % 6 != p["g"] % 6) and rng.random() < 0.7)
    for o in others:
        if count[p["g"]] >= p["degree"]:
            break
        pair = (min(p["g"], o["g"]), max(p["g"], o["g"]))
        if pair in friends or count[o["g"]] >= max(o["degree"], 1) + 8 or count[o["g"]] >= MAX_FRIENDS:
            continue
        friends.add(pair)
        count[p["g"]] += 1
        count[o["g"]] += 1

COLUMNS = ["g", "kind", "d_user", "d_global", "d_avatar", "show_discord", "ign", "fc", "icon", "reddit", "show_reddit",
           "vis", "seen", "joined", "style", "fav", "lean", "stars", "note"]
people_values = ",\n".join("(" + ", ".join(q(p[c]) for c in COLUMNS) + ")" for p in people)
lines_values = ",\n".join(
    f"({q(l['id'])}, {q(l['type'])}, {q(bool(l['rare']))}, date {q(l['addedAt'])}, {UPTAKE.get(l['id'], 1.0)})" for l in LINES)
friend_values = ",\n".join(f"({a}, {b})" for a, b in sorted(friends))

SQL = f"""-- Dev seed: {PLAYERS} varied fake players (generated by scripts/dev_seed.py). DEV PROJECT ONLY.
do $$
begin
  if (select count(*) from auth.users where id::text not like '{PREFIX}%') > 10 then
    raise exception 'This database has real players. The dev seed only runs on a dev project.';
  end if;
end
$$;

-- Start over: removing the auth users cascades to profiles, votes, friendships and requests.
delete from auth.users where id::text like '{PREFIX}%';

drop table if exists dev_people, dev_lines;
create temp table dev_people (
  g int primary key, kind text, d_user text, d_global text, d_avatar text, show_discord boolean, ign text, fc text,
  icon text, reddit text, show_reddit boolean, vis text, seen numeric, joined numeric, style text, fav text,
  lean numeric, stars int, note text, id uuid generated always as (('{PREFIX}' || lpad(g::text, 12, '0'))::uuid) stored
);
insert into dev_people ({", ".join(COLUMNS)}) values
{people_values};

create temp table dev_lines (line_id text primary key, type text, rare boolean, added_at date, uptake numeric);
insert into dev_lines values
{lines_values};

-- Sign-ups: Discord metadata fills the Discord name and picture, like a real login.
insert into auth.users (id, created_at, raw_user_meta_data)
select id, now() - joined * interval '1 day',
  case kind
    when 'discord' then jsonb_strip_nulls(jsonb_build_object(
      'iss', 'https://discord.com/api', 'provider_id', '9000' || g, 'name', d_user,
      'custom_claims', jsonb_build_object('global_name', d_global), 'avatar_url', d_avatar))
    when 'google' then jsonb_build_object('iss', 'https://accounts.google.com')
    else '{{}}'::jsonb
  end
from dev_people;

update public.profiles pr set
  ign = d.ign,
  friend_code = d.fc,
  game_avatar = d.icon,
  reddit_username = d.reddit,
  show_reddit = d.show_reddit,
  show_discord = d.show_discord,
  created_at = now() - d.joined * interval '1 day',
  setup_done = d.ign is not null and d.fc is not null and d.style <> 'new' and d.g % 7 <> 0,
  vote_guide_seen = d.style not in ('new', 'casual')
from dev_people d
where pr.id = d.id;

-- Friendships before visibility: the friend trigger refuses players who are hidden from lookup.
insert into public.friends (user_id, friend_id)
select both_ways.u, both_ways.f
from (values
{friend_values}
) pairs(a, b)
join dev_people pa on pa.g = pairs.a
join dev_people pb on pb.g = pairs.b
cross join lateral (values (pa.id, pb.id), (pb.id, pa.id)) as both_ways(u, f)
on conflict do nothing;

update public.profiles pr set
  open_to_friends = d.vis = 'everyone',
  allow_lookup = d.vis <> 'friends'
from dev_people d
where pr.id = d.id;

-- Votes. A player has a row (any choice, Neutral included) for each line they've
-- opened My Votes on since it came out; brand-new players have none.
with lines as (
  select l.*, 0.1 + 0.5 * random() as want_p, 0.05 + 0.2 * random() as dont_p from dev_lines l
),
rolls as (
  select d.id, d.style, d.fav, d.lean, l.line_id, l.type, l.rare, l.want_p, l.dont_p, l.uptake,
    random() as r, random() as u -- per player and line; a bare random() filter would run once per line
  from dev_people d
  join lines l on l.added_at <= (now() - d.seen * interval '1 day')::date
  where d.style <> 'new'
),
odds as (
  select id, line_id, r,
    case style
      when 'thorough' then least(0.95, want_p * lean)
      when 'casual' then want_p * 0.35
      when 'hoarder' then 0.85
      when 'picky' then 0.06
      when 'specialist' then case when type = fav then 0.95 else 0.08 end
      when 'rare' then case when rare then 0.9 else want_p * 0.4 end
    end as w,
    case style
      when 'thorough' then dont_p
      when 'casual' then dont_p * 0.3
      when 'hoarder' then 0.01
      when 'picky' then 0.55
      when 'specialist' then case when type = fav then 0 else 0.25 end
      when 'rare' then case when rare then 0 else dont_p end
    end as d
  from rolls
  where u < uptake
)
insert into public.preferences (user_id, line_id, choice)
select id, line_id, (case when r < w then 'want' when r < w + d then 'dont_want' else 'undecided' end)::public.choice
from odds;

-- Stars: specialists star their type, rare hunters their rares, everyone else any wants.
update public.preferences p set top = true
from (
  select pr.user_id, pr.line_id, d.stars,
    row_number() over (
      partition by pr.user_id
      order by (d.style = 'specialist' and l.type = d.fav) or (d.style = 'rare' and l.rare) desc, random()
    ) as n
  from public.preferences pr
  join dev_people d on d.id = pr.user_id
  join dev_lines l on l.line_id = pr.line_id
  where pr.choice = 'want'
) pick
where p.user_id = pick.user_id and p.line_id = pick.line_id and pick.n <= pick.stars;

-- Timestamps last, so the vote triggers don't leave everyone "updated just now".
update public.profiles pr set
  last_seen_at = now() - d.seen * interval '1 day',
  prefs_updated_at = case when exists (select 1 from public.preferences p where p.user_id = pr.id)
    then now() - (d.seen + random() * 10) * interval '1 day' end
from dev_people d
where pr.id = d.id;

-- Helpers for your own dev account, found by the IGN you set in Profile.
drop function if exists public.dev_requests_to(text, int);
drop function if exists public.dev_requests_from(text, int);

create or replace function public.dev_player(who text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id from public.profiles pr
  where pr.ign = who and pr.id::text not like '{PREFIX}%'
$$;

-- You and n fake players (with room on their lists) become friends. Random
-- picks across the whole mix: hidden, inactive and vote-less players included.
create or replace function public.dev_befriend(who text, n int default 15)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.dev_player(who);
  added int := 0;
  other uuid;
begin
  if me is null then raise exception 'No dev account with IGN %', who; end if;
  for other in
    select pr.id from public.profiles pr
    where pr.id::text like '{PREFIX}%'
      and pr.allow_lookup
      and not exists (select 1 from public.friends f where f.user_id = me and f.friend_id = pr.id)
      and (select count(*) from public.friends f where f.user_id = pr.id) < public.max_friends()
    order by random()
    limit n
  loop
    insert into public.friends (user_id, friend_id) values (me, other), (other, me) on conflict do nothing;
    added := added + 1;
  end loop;
  return added;
end
$$;

-- n fresh incoming requests from different kinds of sender (no IGN, Discord
-- only, Reddit shown, no icon, ...), about a third sent without a friend code.
-- Plus one expired and one you declined, which should NOT show.
create function public.dev_requests_to(who text, n int default 6)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.dev_player(who);
  added int;
  no_code int;
begin
  if me is null then raise exception 'No dev account with IGN %', who; end if;
  with pool as (
    select pr.id, row_number() over (
      partition by pr.ign is null, pr.game_avatar is null, pr.show_discord and pr.discord_username is not null,
        pr.show_reddit and pr.reddit_username is not null
      order by random()) as rn
    from public.profiles pr
    where pr.id::text like '{PREFIX}%'
      and pr.last_seen_at > now() - interval '30 days'
      and not exists (select 1 from public.friends f where f.user_id = me and f.friend_id = pr.id)
      and not exists (select 1 from public.friend_requests r where r.to_id = me and r.from_id = pr.id)
  ), chosen as (
    select id, (row_number() over (order by rn, random())) % 3 <> 0 as with_code
    from pool order by rn, random() limit n + 2
  ), numbered as (
    select id, with_code, row_number() over () as k from chosen
  )
  insert into public.friend_requests (from_id, to_id, share_code, status, created_at, responded_at)
  select id, me,
    with_code,
    case when k = n + 2 then 'declined' else 'open' end,
    case when k = n + 1 then now() - interval '40 days' else now() - random() * interval '10 days' end,
    case when k = n + 2 then now() end
  from numbered;
  select count(*) filter (where status = 'open' and created_at > now() - interval '30 days'),
         count(*) filter (where status = 'open' and created_at > now() - interval '30 days' and not share_code)
    into added, no_code
  from public.friend_requests where to_id = me;
  return format('%s open incoming (%s without a code), plus 1 expired and 1 declined that should stay hidden', added, no_code);
end
$$;

-- n sent requests from you to a mix of recipients (some with no IGN, some
-- showing only Discord), to check the Sent list never says "Unknown".
create function public.dev_requests_from(who text, n int default 4)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.dev_player(who);
  added int;
begin
  if me is null then raise exception 'No dev account with IGN %', who; end if;
  insert into public.friend_requests (from_id, to_id, created_at)
  select me, picked.id, now() - random() * interval '10 days' from (
    select pr.id, row_number() over (
      partition by pr.ign is null, pr.show_discord and pr.discord_username is not null order by random()) as rn
    from public.profiles pr
    where pr.id::text like '{PREFIX}%'
      and not exists (select 1 from public.friends f where f.user_id = me and f.friend_id = pr.id)
      and not exists (select 1 from public.friend_requests r where r.from_id = me and r.to_id = pr.id)
    order by rn, random()
    limit n
  ) picked
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end
$$;

-- The fake players you sent requests to (from Find New or a lookup) accept,
-- as if they'd tapped Accept: same friend-limit checks as accept_friend_request.
-- Only open, unexpired requests; skips anyone whose list is full. n = null: all.
create or replace function public.dev_accept_sent(who text, n int default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.dev_player(who);
  added int := 0;
  other uuid;
begin
  if me is null then raise exception 'No dev account with IGN %', who; end if;
  for other in
    select r.to_id from public.friend_requests r
    where r.from_id = me and r.to_id::text like '{PREFIX}%'
      and r.status = 'open' and r.created_at > now() - public.request_ttl()
      and (select count(*) from public.friends f where f.user_id = r.to_id) < public.max_friends()
    order by r.created_at
    limit n
  loop
    exit when (select count(*) from public.friends f where f.user_id = me) >= public.max_friends();
    perform public.make_friends(other, me);
    added := added + 1;
  end loop;
  return added;
end
$$;

revoke execute on function public.dev_player(text), public.dev_befriend(text, int), public.dev_requests_to(text, int),
  public.dev_requests_from(text, int), public.dev_accept_sent(text, int)
  from public, anon, authenticated;

-- What landed, and the fixtures to test with.
select coalesce(d.ign, '(no IGN)') as ign, d.note, d.vis, d.kind,
  (select count(*) from public.friends f where f.user_id = d.id) as friends,
  (select count(*) from public.preferences p where p.user_id = d.id and p.choice = 'want') as wants,
  (select count(*) from public.preferences p where p.user_id = d.id and p.top) as stars
from dev_people d
where d.note is not null
union all
select '(all fakes)', format('%s players, %s friendships, %s vote rows; foongus seen by %s active players',
    count(*), (select count(*) / 2 from public.friends where user_id::text like '{PREFIX}%'),
    (select count(*) from public.preferences where user_id::text like '{PREFIX}%'),
    (select count(*) from public.preferences p join public.profiles pr on pr.id = p.user_id
     where p.line_id = 'foongus' and pr.last_seen_at > now() - interval '30 days')),
  null, null, null, null, null
from dev_people;
"""

if __name__ == "__main__":
    print(SQL)
