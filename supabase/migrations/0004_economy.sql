-- 마일스톤 5: 작업 시간 적립 · 재화 · 레벨 · 아이템 해금 · 슬롯 장착
--
-- 재화 규칙 (결정 기록 참고)
--   * 지갑은 개인 하나. 잔액 = 적립(work_log.coins 합) - 사용(unlocks.paid 합).
--   * working 1분 = 기본 2코인. 같은 방에서 동시에 작업 중인 다른 멤버 1명당 +1 (함께 작업하면 더 빨리 쌓임).
--   * 적립은 방과 무관하게 지갑에 영구 보존. 방이 없어도(room_owner_id null) 내 분은 쌓임.
--   * 방 귀속(room_owner_id)은 "방의 함께 쌓은 합계" 표시용. rooms를 참조(FK)하지 않으므로
--     방이 삭제돼도 적립은 남고, 새 방은 rooms.created_at 이후분만 세어 0부터 다시 시작.
--   * 레벨은 누적 적립(사용해도 줄지 않음) 기준.

-- ─────────────────────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────────────────────
alter table public.rooms add column created_at timestamptz not null default now();

create table public.work_log (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  minute_at      timestamptz not null,           -- 서버 시각을 분 단위로 내림
  room_owner_id  uuid,                           -- 그 시점의 방. FK 없음(방 삭제와 무관), 방이 없으면 null
  coins          int  not null check (coins > 0),
  primary key (user_id, minute_at)
);
create index work_log_room on public.work_log (room_owner_id, minute_at) where room_owner_id is not null;

-- 서버 검증용 카탈로그. 원본은 앱의 src/config/*.json 이고, 바꿀 때는 이 값도 같이 바꾼다
-- (scripts/check-catalog.mjs 가 둘이 같은지 확인).
create table public.level_curve (
  level          int primary key,
  required_total int not null check (required_total >= 0)
);
create table public.item_catalog (
  item_id      text primary key,
  category     text not null,
  unlock_level int  not null check (unlock_level >= 1),
  cost         int  not null check (cost >= 0)
);
create table public.slot_catalog (
  slot_id  text primary key,
  category text not null
);

create table public.unlocks (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      text not null references public.item_catalog (item_id),
  paid         int  not null check (paid >= 0),
  unlocked_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.equipped (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  slot_id  text not null references public.slot_catalog (slot_id),
  item_id  text not null references public.item_catalog (item_id),
  primary key (user_id, slot_id)
);

insert into public.level_curve (level, required_total) values
  (1, 0), (2, 100), (3, 300), (4, 600), (5, 1000);

insert into public.item_catalog (item_id, category, unlock_level, cost) values
  ('bed-basic',  'bed',   1, 0),
  ('bed-quilt',  'bed',   3, 120),
  ('desk-basic', 'desk',  1, 0),
  ('desk-wood',  'desk',  2, 80),
  ('shelf-basic','shelf', 2, 60),
  ('deco-plant', 'deco',  2, 50),
  ('deco-lamp',  'deco',  4, 200),
  ('rug-basic',  'rug',   1, 0),
  ('rug-round',  'rug',   5, 300);

insert into public.slot_catalog (slot_id, category) values
  ('bed', 'bed'), ('desk', 'desk'), ('shelf', 'shelf'), ('deco-1', 'deco'), ('rug', 'rug');

-- ─────────────────────────────────────────────────────────────
-- 헬퍼
-- ─────────────────────────────────────────────────────────────
create or replace function public.level_for(p_total bigint)
returns int language sql stable set search_path = public as $$
  select coalesce(max(level), 1) from public.level_curve where required_total <= p_total;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC
-- ─────────────────────────────────────────────────────────────
-- 1분 작업 기록. 같은 분에 몇 번을 불러도 1행만. 반환값은 이번에 적립된 코인(중복이면 0).
create or replace function public.log_minute()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_minute  timestamptz := date_trunc('minute', now());
  v_room    uuid;
  v_others  int := 0;
  v_coins   int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- 방은 클라이언트가 보내지 않는다. 지금 내가 있는 방(없으면 null)을 서버가 정한다.
  v_room := public.get_my_room();

  -- 직전 1분 안에 같은 방에서 작업을 기록한 다른 멤버 수 = 함께 작업 중인 인원
  if v_room is not null then
    select count(distinct user_id) into v_others
    from public.work_log
    where room_owner_id = v_room
      and user_id <> v_uid
      and minute_at >= v_minute - interval '1 minute';
  end if;
  v_coins := 2 + least(v_others, 5);

  insert into public.work_log (user_id, minute_at, room_owner_id, coins)
  values (v_uid, v_minute, v_room, v_coins)
  on conflict (user_id, minute_at) do nothing;

  if not found then return 0; end if;
  return v_coins;
end $$;

-- 내 재화 현황: 누적 적립, 사용, (지금 방의) 함께 쌓은 합계
create or replace function public.get_economy()
returns table (earned bigint, spent bigint, room_total bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(coins) from public.work_log where user_id = auth.uid()), 0)::bigint,
    coalesce((select sum(paid)  from public.unlocks  where user_id = auth.uid()), 0)::bigint,
    coalesce((
      select sum(w.coins) from public.work_log w
      join public.rooms r on r.owner_id = w.room_owner_id
      where r.owner_id = public.get_my_room() and w.minute_at >= r.created_at
    ), 0)::bigint;
$$;

-- 해금: 레벨·잔액을 서버가 검증하고, 해금하면 해당 카테고리 슬롯에 자동 장착한다.
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

  select coalesce(sum(coins), 0) into v_earned from public.work_log where user_id = v_uid;
  select coalesce(sum(paid), 0)  into v_spent  from public.unlocks  where user_id = v_uid;
  if public.level_for(v_earned) < v_item.unlock_level then raise exception 'LEVEL_TOO_LOW'; end if;
  if v_earned - v_spent < v_item.cost then raise exception 'NOT_ENOUGH_COINS'; end if;

  insert into public.unlocks (user_id, item_id, paid) values (v_uid, p_item, v_item.cost);

  insert into public.equipped (user_id, slot_id, item_id)
  select v_uid, s.slot_id, p_item from public.slot_catalog s where s.category = v_item.category
  on conflict (user_id, slot_id) do update set item_id = excluded.item_id;
end $$;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.work_log     enable row level security;
alter table public.unlocks      enable row level security;
alter table public.equipped     enable row level security;
alter table public.level_curve  enable row level security;
alter table public.item_catalog enable row level security;
alter table public.slot_catalog enable row level security;

-- 본인 + 방장(자기 방에 귀속된 분)
create policy work_log_select on public.work_log for select to authenticated
  using (user_id = auth.uid() or room_owner_id = auth.uid());
-- 본인 + 같은 방 멤버(방 그리기용)
create policy unlocks_select on public.unlocks for select to authenticated
  using (public.shares_room(user_id));
create policy equipped_select on public.equipped for select to authenticated
  using (public.shares_room(user_id));
-- 장착: 본인만, 해금한 아이템만, 슬롯과 카테고리가 맞을 때만
create policy equipped_insert on public.equipped for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.unlocks u where u.user_id = auth.uid() and u.item_id = equipped.item_id)
    and exists (
      select 1 from public.slot_catalog s join public.item_catalog i on i.category = s.category
      where s.slot_id = equipped.slot_id and i.item_id = equipped.item_id)
  );
create policy equipped_update on public.equipped for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.unlocks u where u.user_id = auth.uid() and u.item_id = equipped.item_id)
    and exists (
      select 1 from public.slot_catalog s join public.item_catalog i on i.category = s.category
      where s.slot_id = equipped.slot_id and i.item_id = equipped.item_id)
  );
create policy catalog_read_levels on public.level_curve  for select to authenticated using (true);
create policy catalog_read_items  on public.item_catalog for select to authenticated using (true);
create policy catalog_read_slots  on public.slot_catalog for select to authenticated using (true);

revoke all on public.work_log, public.unlocks, public.equipped,
              public.level_curve, public.item_catalog, public.slot_catalog from anon;
revoke insert, update, delete on public.work_log, public.unlocks,
              public.level_curve, public.item_catalog, public.slot_catalog from authenticated;
revoke insert, update, delete on public.equipped from authenticated;
grant insert (user_id, slot_id, item_id) on public.equipped to authenticated;
grant update (item_id) on public.equipped to authenticated;

revoke execute on function public.level_for(bigint), public.log_minute(), public.get_economy(),
  public.unlock_item(text) from public, anon, authenticated;
grant execute on function public.log_minute(), public.get_economy(), public.unlock_item(text) to authenticated;
