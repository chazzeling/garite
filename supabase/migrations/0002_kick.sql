-- 마일스톤 4: 강퇴 (kick_member RPC + 시스템 메시지 + 대상에게 알림)
-- 강퇴 ≠ 차단: room_members만 비활성화하고, 코드로 다시 들어올 수 있다.

-- p_reason: '자리 비움' / '방 정리' / 직접 입력 (1~30자). 호출자는 방장이어야 한다.
create or replace function public.kick_member(p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_name   text;
  v_hit    int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  -- 방장 확인은 항상 rooms.owner_id = auth.uid()
  if not exists (select 1 from public.rooms where owner_id = v_uid) then
    raise exception 'NOT_ROOM_OWNER';
  end if;
  if p_target is null or p_target = v_uid then raise exception 'CANNOT_KICK_SELF'; end if;
  if char_length(v_reason) not between 1 and 30 then raise exception 'REASON_INVALID'; end if;

  -- join_room과 같은 잠금: 강퇴와 입장이 겹쳐도 순서가 보장된다
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  update public.room_members set is_active = false, left_at = now()
  where room_owner_id = v_uid and user_id = p_target and is_active;
  get diagnostics v_hit = row_count;
  if v_hit = 0 then raise exception 'TARGET_NOT_MEMBER'; end if;

  select name into v_name from public.profiles where id = p_target;

  -- 시스템 메시지는 이 함수(security definer)만 쓸 수 있다
  insert into public.messages (room_owner_id, user_id, kind, body)
  values (v_uid, null, 'system',
          coalesce(v_name, '멤버') || '님이 강퇴되었어요 · 사유: ' || v_reason);

  -- 대상의 모든 창에 알림 (user:{id} 비공개 채널). 실패해도 강퇴 자체는 유효하다.
  begin
    perform realtime.send(
      jsonb_build_object('roomOwnerId', v_uid, 'reason', v_reason),
      'kick', 'user:' || p_target::text, true);
  exception when others then
    null;
  end;
end $$;

revoke execute on function public.kick_member(uuid, text) from public, anon;
grant execute on function public.kick_member(uuid, text) to authenticated;
