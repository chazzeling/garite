-- 방 모델 변경: 항상 존재하는 내 방 → 만들고 닫는 방.
--   create_room : 새 방 + 새 코드 (이전 방과 그 채팅 기록은 삭제)
--   close_room  : 방 닫기 (멤버는 내보내지고, 코드는 무효, 채팅 기록 삭제)
-- room_members·messages는 rooms에 on delete cascade라 방을 지우면 같이 지워진다.

-- 이전 모델로 만들어진 방(테스트 데이터)은 모두 정리한다.
delete from public.rooms;

drop function if exists public.ensure_my_room();

-- 방이 실제로 있어야 멤버로 인정 (방이 없는 방장이 room:{내 id} 채널을 쓰지 못하게)
create or replace function public.is_room_member(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner is not null and exists (select 1 from public.rooms r where r.owner_id = p_owner) and (
    p_owner = auth.uid()
    or exists (
      select 1 from public.room_members m
      where m.room_owner_id = p_owner and m.user_id = auth.uid() and m.is_active
    )
  );
$$;

-- 지금 내가 있는 방(남의 방에 들어가 있으면 그 방장, 내 방이 있으면 나, 없으면 null)
create or replace function public.get_my_room()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select room_owner_id from public.room_members where user_id = auth.uid() and is_active),
    (select owner_id from public.rooms where owner_id = auth.uid())
  );
$$;

-- 방을 없앤다 (내부용). 활성 멤버 전원에게 닫힘을 알린 뒤 삭제.
create or replace function public.drop_room(p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
begin
  for m in
    select user_id from public.room_members where room_owner_id = p_owner and is_active
  loop
    begin
      perform realtime.send(
        jsonb_build_object('roomOwnerId', p_owner, 'kind', 'closed'),
        'kick', 'user:' || m.user_id::text, true);
    exception when others then
      null;
    end;
  end loop;
  delete from public.rooms where owner_id = p_owner;
end $$;

create or replace function public.create_room()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'PROFILE_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public.drop_room(v_uid);
  perform public.leave_room(); -- 내 방에 들어가므로 남의 방에서는 나온다

  insert into public.rooms (owner_id, code)
  values (v_uid, public.generate_room_code())
  returning code into v_code;
  return v_code;
end $$;

create or replace function public.close_room()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  perform public.drop_room(auth.uid());
end $$;

revoke execute on function public.drop_room(uuid) from public, anon, authenticated;
revoke execute on function public.create_room(), public.close_room() from public, anon;
grant execute on function public.create_room(), public.close_room() to authenticated;
