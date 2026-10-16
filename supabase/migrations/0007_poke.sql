-- 찌르기: 같은 방 멤버가 서로를 찔러 알림을 보낸다 (딴짓 방지용).
--   * 방장 권한과 무관: 호출자와 대상이 같은 방(방장 또는 활성 멤버)에 있으면 누구나 누구에게.
--   * 같은 사람→같은 사람은 30초에 한 번 (스팸 방지). 값을 바꾸려면 아래 interval과 config/activity.json의 pokeCooldownSeconds를 같이 바꾼다.
--   * 알림은 대상의 user:{id} 비공개 채널로 'poke' 이벤트를 보낸다. 클라이언트가 직접 쓰지 못하고 이 RPC로만.

create table public.poke_cooldown (
  sender_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  last_at   timestamptz not null,
  primary key (sender_id, target_id)
);
alter table public.poke_cooldown enable row level security; -- 정책 없음 = 클라이언트 접근 불가
revoke all on public.poke_cooldown from anon, authenticated;

create or replace function public.poke_member(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_room uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_target is null or p_target = v_uid then raise exception 'CANNOT_POKE_SELF'; end if;

  v_room := public.get_my_room();
  if v_room is null then raise exception 'NOT_IN_ROOM'; end if;
  if not (
    p_target = v_room
    or exists (
      select 1 from public.room_members m
      where m.room_owner_id = v_room and m.user_id = p_target and m.is_active)
  ) then
    raise exception 'TARGET_NOT_IN_ROOM';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_target::text, 2));
  if exists (
    select 1 from public.poke_cooldown
    where sender_id = v_uid and target_id = p_target and last_at > now() - interval '30 seconds'
  ) then
    raise exception 'POKE_COOLDOWN';
  end if;
  insert into public.poke_cooldown (sender_id, target_id, last_at) values (v_uid, p_target, now())
  on conflict (sender_id, target_id) do update set last_at = excluded.last_at;

  select name into v_name from public.profiles where id = v_uid;
  -- 전달에 실패하면 예외로 되돌려 쿨다운도 소모하지 않는다
  perform realtime.send(
    jsonb_build_object('fromId', v_uid, 'fromName', coalesce(v_name, '친구')),
    'poke', 'user:' || p_target::text, true);
end $$;

revoke execute on function public.poke_member(uuid) from public, anon;
grant execute on function public.poke_member(uuid) to authenticated;
