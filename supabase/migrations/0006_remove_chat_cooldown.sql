-- 채팅 쿨다운(2초) 제거. 친구끼리 쓰는 앱에서 정상 사용을 막는 불편이 더 커서 없앤다.
-- 도배 방지가 다시 필요해지면(배포 시) 더 느슨한 규칙(예: 10초에 10개)으로 새로 추가한다.
drop trigger if exists messages_cooldown_trg on public.messages;
drop function if exists public.messages_cooldown();
