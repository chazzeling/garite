-- 하루 목표 보너스 · 작업 시간 통계 · 채팅 도배 제한 · 방장 id로 입장(자주 가는 방).
--   * goal_claims : 오늘 받은 목표 기록. PK(user_id, day, goal_id) → 같은 날 같은 목표는 한 번만.
--       날짜 기준은 한국 시간(Asia/Seoul) 자정. 보너스는 claim_goals() RPC로만 쌓인다.
--   * 목표 단계(60/180/300분)와 보너스(40/100/160 코인)는 이 파일의 goal_tiers()가 기준이고,
--     앱의 src/config/goals.json은 표시용 복사본이다. 바꾸면 둘을 같이 고칠 것.
--   * get_economy / unlock_item : earned에 보너스를 포함 (레벨·잔액 계산이 같은 값을 쓰도록).
--   * get_goals : 오늘/이번 주(월요일 시작) 작업 분 + 오늘 받은 목표.
--   * 채팅 도배 제한 : 10초에 20개 (쿨다운은 따로 없음). 초과하면 CHAT_RATE_LIMIT.
--   * join_room_by_owner : 친구(방장) id로 그 사람의 지금 방에 입장. 코드는 방을 새로 만들 때마다 바뀌므로
--     자주 가는 방은 "사람"을 저장한다.
-- 이 파일은 다시 실행해도 안전하다.

create table if not exists public.goal_claims (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  goal_id    text not null,
  coins      int  not null check (coins > 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id, day, goal_id)
);
alter table public.goal_claims enable row level security;
drop policy if exists goal_claims_select on public.goal_claims;
create policy goal_claims_select on public.goal_claims for select to authenticated
  using (user_id = auth.uid());

create or replace function public.goal_tiers()
returns table (goal_id text, minutes int, coins int)
language sql immutable as $$
  select * from (values ('g60', 60, 40), ('g180', 180, 100), ('g300', 300, 160)) as t(goal_id, minutes, coins);
$$;

create or replace function public.kst_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- 내가 번 총량 = 작업 코인 + 목표 보너스
create or replace function public.earned_total(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select sum(coins) from public.work_log where user_id = p_user), 0)
       + coalesce((select sum(coins) from public.goal_claims where user_id = p_user), 0);
$$;

create or replace function public.get_economy()
returns table (earned bigint, spent bigint, room_total bigint, room_age_seconds bigint, room_work_minutes bigint)
language sql stable security definer set search_path = public as $$
  select
    public.earned_total(auth.uid()),
    coalesce((select sum(paid)  from public.unlocks  where user_id = auth.uid()), 0)::bigint,
    coalesce((
      select sum(w.coins) from public.work_log w
      join public.rooms r on r.owner_id = w.room_owner_id
      where r.owner_id = public.get_my_room() and w.minute_at >= r.created_at
    ), 0)::bigint,
    (select extract(epoch from now() - r.created_at)::bigint
       from public.rooms r where r.owner_id = public.get_my_room()),
    coalesce((
      select count(*) from public.work_log w
      join public.rooms r on r.owner_id = w.room_owner_id
      where r.owner_id = public.get_my_room() and w.user_id = auth.uid()
        and w.strict and w.minute_at >= r.created_at
    ), 0)::bigint;
$$;

create or replace function public.unlock_item(p_item text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_item   public.item_catalog%rowtype;
  v_earned bigint;
  v_spent  bigint;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_item from public.item_catalog where item_id = p_item;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 1));
  if exists (select 1 from public.unlocks where user_id = v_uid and item_id = p_item) then
    raise exception 'ALREADY_UNLOCKED';
  end if;

  v_earned := public.earned_total(v_uid);
  select coalesce(sum(paid), 0) into v_spent from public.unlocks where user_id = v_uid;
  if public.level_for(v_earned) < v_item.unlock_level then raise exception 'LEVEL_TOO_LOW'; end if;
  if v_earned - v_spent < v_item.cost then raise exception 'NOT_ENOUGH_COINS'; end if;

  insert into public.unlocks (user_id, item_id, paid) values (v_uid, p_item, v_item.cost);

  insert into public.equipped (user_id, slot_id, item_id)
  select v_uid, s.slot_id, p_item from public.slot_catalog s where s.category = v_item.category
  on conflict (user_id, slot_id) do update set item_id = excluded.item_id;
end $$;

-- 오늘·이번 주 작업 분과 오늘 받은 목표
drop function if exists public.get_goals();
create function public.get_goals()
returns table (today_minutes int, week_minutes int, claimed text[])
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.work_log
      where user_id = auth.uid()
        and (minute_at at time zone 'Asia/Seoul')::date = public.kst_today())::int,
    (select count(*) from public.work_log
      where user_id = auth.uid()
        and (minute_at at time zone 'Asia/Seoul')::date >= date_trunc('week', public.kst_today())::date)::int,
    coalesce((select array_agg(goal_id order by goal_id) from public.goal_claims
      where user_id = auth.uid() and day = public.kst_today()), '{}');
$$;

-- 달성했는데 아직 안 받은 목표를 받는다. 새로 받은 것만 돌려준다.
drop function if exists public.claim_goals();
create function public.claim_goals()
returns table (goal_id text, coins int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date := public.kst_today();
  v_min int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 2));
  select count(*) into v_min from public.work_log
    where user_id = v_uid and (minute_at at time zone 'Asia/Seoul')::date = v_day;

  return query
  insert into public.goal_claims (user_id, day, goal_id, coins)
  select v_uid, v_day, t.goal_id, t.coins from public.goal_tiers() t where t.minutes <= v_min
  on conflict do nothing
  returning goal_claims.goal_id, goal_claims.coins;
end $$;

-- 채팅 도배 제한: 10초에 20개
create or replace function public.messages_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'chat' and (
    select count(*) from public.messages
    where user_id = new.user_id and kind = 'chat' and created_at > new.created_at - interval '10 seconds'
  ) >= 20 then
    raise exception 'CHAT_RATE_LIMIT';
  end if;
  return new;
end $$;
drop trigger if exists messages_rate_limit_trg on public.messages;
create trigger messages_rate_limit_trg before insert on public.messages
  for each row execute function public.messages_rate_limit();

-- 방장 id로 입장: 그 사람의 지금 방 코드를 찾아 join_room에 넘긴다 (정원·열림 검증은 join_room이 한다).
create or replace function public.join_room_by_owner(p_owner uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select code into v_code from public.rooms where owner_id = p_owner;
  if v_code is null then raise exception 'ROOM_NOT_FOUND'; end if;
  return public.join_room(v_code);
end $$;

revoke execute on function
  public.goal_tiers(), public.kst_today(), public.earned_total(uuid), public.get_economy(),
  public.unlock_item(text), public.get_goals(), public.claim_goals(), public.join_room_by_owner(uuid)
  from public, anon, authenticated;
grant execute on function
  public.get_economy(), public.unlock_item(text), public.get_goals(), public.claim_goals(),
  public.join_room_by_owner(uuid)
  to authenticated;
