# Supabase 설정 (마일스톤 2)

1. supabase.com에서 무료 프로젝트 생성
2. **Authentication → Sign In / Providers → Anonymous sign-ins** 켜기
3. **SQL Editor**에 `migrations/0001_init.sql`, 이어서 `0002_kick.sql`, `0003_ephemeral_rooms.sql` 전체를 붙여넣고 실행
4. **Realtime → Settings → Allow public access** 끄기 (비공개 채널 권한 강제)
5. 프로젝트 URL과 anon key를 루트의 `.env.local`에 넣기 (`.env.example` 참고)
6. `npm run tauri dev` 재시작

## 검증 체크리스트
- 코드 없이 `room:{ownerId}` 채널 구독 시도 → 거절
- 같은 방에 6번째 멤버(방장 + 5명 초과) 입장 → `ROOM_FULL`
- (채팅 쿨다운은 0006에서 제거됨)
- 클라이언트에서 `kind='system'` insert → 거절
- 방장 아닌 계정으로 `kick_member` 호출 → `NOT_ROOM_OWNER`
- 강퇴당한 계정: 배너 표시, 채팅 창 닫힘, 코드로 재입장 가능
- 방 만들기를 다시 누르면 코드가 바뀌고 이전 채팅 기록이 사라짐
