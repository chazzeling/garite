-- 입장/퇴장 시스템 메시지. 시스템 메시지는 이 RPC들(security definer)만 쓸 수 있다.
--   "○○님이 입장하셨습니다." / "○○님이 퇴장하셨습니다."
-- 강퇴는 기존 kick_member 메시지, 방이 닫히면(drop_room) 기록 자체가 삭제되므로 퇴장 메시지는 없다.
-- 방장은 자기 방에 room_members 행이 없어 입퇴장 메시지 대상이 아니다(방 안의 손님만).

create or replace function public.post_member_event(p_room uuid, p_user uuid, p_verb text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select name into v_name from public.profiles where id = p_user;
  insert into public.messages (room_owner_id, user_id, kind, body)
  values (p_room, null, 'system', coalesce(v_name, '멤버') || '님이 ' || p_verb || '하셨습니다.');
end $$;

-- 내가 들어가 있는 방에서 나온다 (내부용). 나왔으면 그 방에 퇴장 메시지를 남긴다.
create or replace function public.leave_active_room(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
begin
  update public.room_members set is_active = false, left_at = now()
  where user_id = p_user and is_active
  returning room_owner_id into v_room;
  if v_room is not null then
    perform public.post_member_event(v_room, p_user, '퇴장');
  end if;
end $$;

create or replace function public.leave_room()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.leave_active_room(auth.uid());
end $$;

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

revoke execute on function public.post_member_event(uuid, uuid, text), public.leave_active_room(uuid)
  from public, anon, authenticated;
