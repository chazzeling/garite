-- 방 시계: "방을 만든 지 N분" + "이 방에서 내가 작업한 시간"을 보여주기 위한 서버 값.
--   * work_log.strict : 그 분이 "등록한 프로그램만" 모드로 기록됐는지. 모드를 중간에 바꿔도 작업 시간 표시가 섞이지 않게.
--   * log_minute(p_strict) : 앱이 모드를 알려준다 (인자 없이 부르는 예전 앱은 strict=false로 기록).
--   * get_economy : room_age_seconds(방이 만들어진 뒤 경과 초, 서버 시각 기준이라 시계 오차 없음),
--                   room_work_minutes(이 방에서 내가 strict로 기록한 분 수) 추가.
-- 반환 형식이 바뀌어 두 함수는 drop 후 다시 만든다.
-- 이 파일은 몇 번을 다시 실행해도 안전하다(이미 적용된 부분은 건너뜀).

alter table public.work_log add column if not exists strict boolean not null default false;

drop function if exists public.log_minute();
create or replace function public.log_minute(p_strict boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_minute  timestamptz := date_trunc('minute', now());
  v_room    uuid;
  v_others  int := 0;
  v_coins   int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  v_room := public.get_my_room();

  if v_room is not null then
    select count(distinct user_id) into v_others
    from public.work_log
    where room_owner_id = v_room
      and user_id <> v_uid
      and minute_at >= v_minute - interval '1 minute';
  end if;
  v_coins := 2 + least(v_others, 5);

  insert into public.work_log (user_id, minute_at, room_owner_id, coins, strict)
  values (v_uid, v_minute, v_room, v_coins, coalesce(p_strict, false))
  on conflict (user_id, minute_at) do nothing;

  if not found then return 0; end if;
  return v_coins;
end $$;

drop function if exists public.get_economy();
create function public.get_economy()
returns table (earned bigint, spent bigint, room_total bigint, room_age_seconds bigint, room_work_minutes bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(coins) from public.work_log where user_id = auth.uid()), 0)::bigint,
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

revoke execute on function public.log_minute(boolean), public.get_economy() from public, anon, authenticated;
grant execute on function public.log_minute(boolean), public.get_economy() to authenticated;
