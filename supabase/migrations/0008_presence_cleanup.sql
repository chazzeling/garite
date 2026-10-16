-- 비정상 종료(강제 종료·절전·네트워크 끊김) 정리.
--   * 앱이 1분마다 heartbeat()를 호출해 room_members.last_seen을 갱신한다.
--   * last_seen이 3분 넘게 멈춘 활성 멤버는 퇴장 처리한다(퇴장 시스템 메시지 포함).
--   * 정리는 별도 스케줄러 없이, 누군가 heartbeat()나 join_room()을 호출할 때 함께 한다.
--   * 정상 종료는 앱이 직접 leave_room / close_room을 부른다(이 마이그레이션과 무관).
-- 임계값(3분)과 앱의 호출 주기(1분)를 바꾸면 서로 맞춰 둘 것.

alter table public.room_members add column last_seen timestamptz not null default now();
create index room_members_active_seen on public.room_members (last_seen) where is_active;

create or replace function public.sweep_stale_members()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    with s as (
      update public.room_members set is_active = false, left_at = now()
      where is_active and last_seen < now() - interval '3 minutes'
      returning room_owner_id, user_id
    )
    select * from s
  loop
    perform public.post_member_event(r.room_owner_id, r.user_id, '퇴장');
  end loop;
end $$;

-- "나 살아 있어요". 지금 내가 있는 방(방장 id, 내 방, 없으면 null)을 돌려줘서
-- 오래 끊겼다가 돌아온 앱이 이미 방에서 나가졌는지 알 수 있게 한다.
create or replace function public.heartbeat()
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.room_members set last_seen = now() where user_id = auth.uid() and is_active;
  perform public.sweep_stale_members();
  return public.get_my_room();
end $$;

-- join_room: 입장 전에 오래된 멤버를 먼저 정리 (비정상 종료로 남은 자리가 정원을 막지 않게)
create or replace function public.join_room(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_room  public.rooms%rowtype;
  v_count int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'PROFILE_REQUIRED';
  end if;

  perform public.sweep_stale_members();

  select * into v_room from public.rooms where code = v_code;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- 내 방 코드를 입력하면 그냥 내 방으로
  if v_room.owner_id = v_uid then
    perform public.leave_room();
    return v_uid;
  end if;

  if not v_room.is_open then raise exception 'ROOM_CLOSED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_room.owner_id::text, 0));

  if exists (
    select 1 from public.room_members
    where room_owner_id = v_room.owner_id and user_id = v_uid and is_active
  ) then
    update public.room_members set last_seen = now()
    where room_owner_id = v_room.owner_id and user_id = v_uid and is_active;
    return v_room.owner_id;
  end if;

  select count(*) into v_count
  from public.room_members where room_owner_id = v_room.owner_id and is_active;
  if v_count >= 5 then raise exception 'ROOM_FULL'; end if;

  perform public.leave_active_room(v_uid); -- 다른 방에 있었다면 거기서 퇴장

  insert into public.room_members (room_owner_id, user_id) values (v_room.owner_id, v_uid);
  perform public.post_member_event(v_room.owner_id, v_uid, '입장');
  return v_room.owner_id;
end $$;

revoke execute on function public.sweep_stale_members() from public, anon, authenticated;
revoke execute on function public.heartbeat() from public, anon;
grant execute on function public.heartbeat() to authenticated;
