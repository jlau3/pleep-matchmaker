-- Top 3: each player can star up to max_top() of their wants.
--
-- A starred line is always a want: switching it to don't want or undecided
-- unstars it. In matching, a line either player starred counts
-- top_multiplier() times over (both want +6 instead of +3, a clash -6), and
-- its best case grows by the same factor so percentages stay 0-100.
-- get_friends, lookup_players and get_line_stats gain the starred lines.

alter table public.preferences add column top boolean not null default false;
alter table public.preferences add constraint preferences_top_is_want check (not top or choice = 'want');

create index preferences_top_idx on public.preferences (user_id) where top;

create function public.max_top()
returns int
language sql
immutable
as $$ select 3 $$;

create function public.top_multiplier()
returns int
language sql
immutable
as $$ select 2 $$;

create function public.check_preference_top()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.choice <> 'want' then
    new.top := false;
  end if;
  if new.top and (tg_op = 'INSERT' or not old.top) then
    -- Serialize per user so concurrent stars can't overshoot the cap.
    perform 1 from public.profiles where id = new.user_id for update;
    if (select count(*) from public.preferences
        where user_id = new.user_id and top and line_id <> new.line_id) >= public.max_top() then
      raise exception 'top_limit' using hint = format('You can star up to %s', public.max_top());
    end if;
  end if;
  return new;
end;
$$;

-- Fires before on_preference_written (triggers run in name order), so a
-- cleared star is already applied when prefs_updated_at is considered.
create trigger on_preference_top
  before insert or update on public.preferences
  for each row execute function public.check_preference_top();

-- Starring or unstarring also counts as a preference change.
create or replace function public.touch_prefs_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.choice = new.choice and old.top = new.top then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  update public.profiles set prefs_updated_at = now() where id = new.user_id;
  return new;
end;
$$;

create or replace function public.get_matches()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  match_pct int,
  shared_wants text[],
  shared_dont_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  me as (select auth.uid() as id),
  mine as (
    select p.line_id, p.choice, p.top
    from public.preferences p
    where p.user_id = (select id from me) and p.choice <> 'undecided'
  ),
  candidates as (
    select pr.*
    from public.profiles pr, cfg
    where pr.id <> (select id from me)
      and pr.open_to_friends
      and pr.friend_code is not null
      and pr.last_seen_at > now() - cfg.stale_after
      and (select count(*) from public.friends f where f.user_id = pr.id) < public.max_friends()
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
  ),
  theirs as (
    select p.user_id, p.line_id, p.choice, p.top
    from public.preferences p
    join candidates c on c.id = p.user_id
    where p.choice <> 'undecided'
  ),
  pair_lines as (
    select c.id as other_id, m.line_id from candidates c cross join mine m
    union
    select t.user_id, t.line_id from theirs t
  ),
  scored as (
    select pl.other_id, pl.line_id, m.choice as a, t.choice as b,
           -- A line either side starred counts top_multiplier() times over.
           case when coalesce(m.top, false) or coalesce(t.top, false) then public.top_multiplier() else 1 end as mult
    from pair_lines pl
    left join mine m on m.line_id = pl.line_id
    left join theirs t on t.user_id = pl.other_id and t.line_id = pl.line_id
  ),
  agg as (
    select
      s.other_id,
      sum(s.mult * case
            when s.a = 'want' and s.b = 'want' then cfg.w_both_want
            when s.a = 'dont_want' and s.b = 'dont_want' then cfg.w_both_dont
            when (s.a = 'want' and s.b = 'dont_want') or (s.a = 'dont_want' and s.b = 'want') then cfg.w_conflict
            else 0
          end) as score,
      sum(s.mult * case when s.a = 'want' or s.b = 'want' then cfg.w_both_want else cfg.w_both_dont end) as best,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'want' and s.b = 'want'), '{}') as shared_wants,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'dont_want' and s.b = 'dont_want'), '{}') as shared_dont_wants
    from scored s, cfg
    group by s.other_id
  )
  select
    c.id,
    c.discord_username,
    c.discord_display_name,
    c.avatar_url,
    c.ign,
    c.friend_code,
    c.last_seen_at,
    c.prefs_updated_at,
    round(100.0 * greatest(a.score, 0) / a.best)::int as match_pct,
    a.shared_wants,
    a.shared_dont_wants
  from agg a
  join candidates c on c.id = a.other_id
  cross join cfg
  where cardinality(a.shared_wants) >= cfg.min_shared_wants
    and 100.0 * greatest(a.score, 0) / a.best >= cfg.min_pct
  order by match_pct desc, cardinality(a.shared_wants) desc, c.last_seen_at desc
  limit 100
$$;

drop function public.lookup_players(text);

create function public.lookup_players(q text)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  wants text[],
  dont_wants text[],
  top_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  needle as (
    select
      lower(trim(both '@ ' from q)) as text_q,
      nullif(regexp_replace(q, '[^0-9]', '', 'g'), '') as digits_q
  ),
  hits as (
    select pr.*
    from public.profiles pr, needle n
    where pr.allow_lookup
      and char_length(n.text_q) >= 2
      and (
        lower(pr.discord_username) = n.text_q
        or lower(pr.discord_display_name) = n.text_q
        or lower(pr.ign) = n.text_q
        or (char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q)
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
    limit 20
  )
  select
    h.id,
    h.discord_username,
    h.discord_display_name,
    h.avatar_url,
    h.ign,
    h.friend_code,
    h.last_seen_at,
    h.prefs_updated_at,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.top), '{}')
  from hits h
  order by h.last_seen_at desc
$$;

drop function public.get_line_stats();

-- Community vote counts per line among active players. Aggregates only.
create function public.get_line_stats()
returns table (line_id text, wants bigint, dont_wants bigint, tops bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.line_id,
         count(*) filter (where p.choice = 'want'),
         count(*) filter (where p.choice = 'dont_want'),
         count(*) filter (where p.top)
  from public.preferences p
  join public.profiles pr on pr.id = p.user_id
  cross join public.match_config() cfg
  where pr.last_seen_at > now() - cfg.stale_after
  group by p.line_id
$$;

drop function public.get_friends();

create function public.get_friends()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  added_at timestamptz,
  visible boolean,
  wants text[],
  dont_wants text[],
  top_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    pr.discord_username,
    pr.discord_display_name,
    pr.avatar_url,
    case when pr.allow_lookup then pr.ign end,
    case when pr.allow_lookup then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    f.created_at,
    pr.allow_lookup,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.top), '{}') else '{}' end
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

revoke execute on function
  public.lookup_players(text),
  public.get_line_stats(),
  public.get_friends()
from public, anon;

grant execute on function
  public.lookup_players(text),
  public.get_line_stats(),
  public.get_friends()
to authenticated;
