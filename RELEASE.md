# 개릿 릴리스 · 테스트 가이드

새 버전을 내보낼 때마다 이 순서로 한다. (v0.1.2 기준 — 0.1.1 이후 쌓인 변경이 한꺼번에 나간다)

## 0. 원칙

- **DB 먼저, 앱 나중.** 새 앱은 새 DB 함수를 부른다(예: `log_minute(p_strict)`). 앱을 먼저 내보내면 새 기능이 오류를 낸다. 예전 앱은 새 DB에서도 동작하도록 만들어져 있다.
- 마이그레이션 0007~0010은 **다시 실행해도 안전**하다(이미 적용된 부분은 건너뜀). 헷갈리면 네 개를 순서대로 다 돌려도 된다. (0004 이전은 다시 실행하면 오류)
- 비밀 값(`.env.local`, `~/.tauri/garite.key`)은 저장소에 올리지 않는다.

## 1. DB 상태 확인 (Supabase → SQL Editor)

아래를 실행하면 항목별로 `ok`가 `true`/`false`로 나온다. 전부 `true`여야 한다.

```sql
select item, ok from (
  select 1 n, '0005 입퇴장 메시지 함수'                as item, exists(select 1 from pg_proc where proname = 'post_member_event' and pronamespace = 'public'::regnamespace) as ok
  union all select 2, '0006 채팅 쿨다운 제거',            not exists(select 1 from pg_trigger where tgname = 'messages_cooldown_trg')
  union all select 3, '0007 찌르기 함수',                 exists(select 1 from pg_proc where proname = 'poke_member' and pronamespace = 'public'::regnamespace)
  union all select 4, '0007 찌르기 쿨다운 테이블',        to_regclass('public.poke_cooldown') is not null
  union all select 5, '0008 room_members.last_seen',      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'room_members' and column_name = 'last_seen')
  union all select 6, '0008 heartbeat()',                 exists(select 1 from pg_proc where proname = 'heartbeat' and pronamespace = 'public'::regnamespace)
  union all select 7, '0008 join_room이 오래된 멤버 정리', coalesce((select pg_get_functiondef(p.oid) from pg_proc p where p.proname = 'join_room' and p.pronamespace = 'public'::regnamespace limit 1) like '%sweep_stale_members%', false)
  union all select 8, '0009 꾸미기 아이템 13개',          (select count(*) from public.item_catalog where category in ('hair', 'outfit', 'accessory')) = 13
  union all select 9, '0009 아바타 검증 트리거',          exists(select 1 from pg_trigger where tgname = 'profiles_avatar_trg')
  union all select 10, '0010 work_log.strict',            exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'work_log' and column_name = 'strict')
  union all select 11, '0010 log_minute(p_strict)',       exists(select 1 from pg_proc where proname = 'log_minute' and pronamespace = 'public'::regnamespace and pg_get_function_arguments(oid) like 'p_strict boolean%')
  union all select 12, '0010 get_economy 방 시계 컬럼',   exists(select 1 from pg_proc where proname = 'get_economy' and pronamespace = 'public'::regnamespace and pg_get_function_result(oid) like '%room_age_seconds%' and pg_get_function_result(oid) like '%room_work_minutes%')
) t order by n;
```

- `false`가 있으면 해당 번호의 마이그레이션 파일(`supabase/migrations/`)을 **열어서 통째로 붙여 넣고 실행**한다. 순서는 0007 → 0008 → 0009 → 0010.
- 마이그레이션을 실행한 뒤에는 API 캐시를 새로 읽게 한다:

```sql
notify pgrst, 'reload schema';
```

- 마지막으로 위 확인 쿼리를 다시 실행해 전부 `true`인지 본다.

## 2. 배포 순서

1. **DB 확인** (위 1번) — 전부 `true`.
2. **로컬 점검**
   ```bash
   npx tsc --noEmit
   node scripts/check-catalog.mjs
   npm run build
   ```
   그리고 `npm run tauri dev`로 켜서 아래 4번 체크리스트의 **A·B·C**만 먼저 훑는다.
3. **버전 올리기**
   ```bash
   node scripts/release.mjs 0.1.2
   ```
4. **커밋 · 태그 · 올리기**
   ```bash
   git add -A
   git commit -m "v0.1.2"
   git tag v0.1.2
   git push && git push --tags
   ```
5. **빌드 기다리기** (10~15분): https://github.com/chazzeling/garite/actions — Mac 2종 + Windows가 모두 초록색이어야 한다.
6. **릴리스 확인**: https://github.com/chazzeling/garite/releases — 설치 파일 3종(`aarch64.dmg`, `x64.dmg`, `.exe`)과 `latest.json`이 있는지.
7. **자동 업데이트 시험**: 0.1.1이 설치된 앱을 켜고(켠 뒤 10초, 이후 30분마다 확인) 배너 "새 버전 0.1.2이 나왔어요 → 지금 업데이트"가 뜨는지, 누르면 재시작되어 0.1.2가 되는지.
8. 친구들에게 알린다. 새로 설치하는 사람은 릴리스 페이지에서 파일을 받는다(아래 5번 안내문 참고).

### 문제가 생기면

- **빌드 실패**: Actions 로그의 `failed` 단계를 본다. 고친 뒤 **같은 버전 태그를 다시 쓰지 말고** 새 버전(0.1.3)으로 올린다.
- **새 버전에 큰 버그**: 이전 코드로 되돌린 내용을 **더 높은 버전**(예: 0.1.3)으로 다시 배포한다(업데이트는 가장 높은 버전만 따라가므로 낮은 번호로는 롤백이 안 된다).
- **DB 변경이 문제**: 마이그레이션은 되돌리기용 파일이 없다. 새 마이그레이션(번호 +1)으로 고친다.

## 3. 테스트 준비

- 컴퓨터(또는 계정) **2대**가 필요하다. 한 대는 방장, 다른 한 대는 손님. Mac·Windows가 섞이면 가장 좋다.
- 시간이 오래 걸리는 확인(방 레벨, 비정상 종료 정리)을 빨리 하는 방법 (Supabase SQL Editor, **테스트 방에만**):
  ```sql
  -- 방 만든 지 2시간 지난 것처럼 (방 레벨 '전구' → '전등' 확인용)
  update public.rooms set created_at = now() - interval '2 hours' where owner_id = '<방장 user id>';
  -- 3분 넘게 신호가 끊긴 것처럼 (비정상 종료 정리 확인용)
  update public.room_members set last_seen = now() - interval '4 minutes' where user_id = '<손님 user id>' and is_active;
  ```
  user id는 `select id, name from public.profiles;`로 찾는다.
- 앱이 이상하면 레벨 칩의 코인 자리에 **⚠**가 뜬다(마우스를 올리면 서버 오류 사유).

## 4. 실기기 테스트 체크리스트

각 항목을 해 보고 `[x]`로 표시한다. 실패하면 화면 문구와 어떤 컴퓨터(Mac/Windows)인지 적어 둔다.

### A. 설치 · 업데이트
- [ ] Mac(Apple 실리콘) dmg 설치 → 처음 열 때 경고가 어떻게 뜨는지 (뜨면 `xattr -cr /Applications/garite.app`)
- [ ] Mac(Intel) 설치
- [ ] Windows 설치 → SmartScreen 경고 후 "추가 정보 → 실행"으로 열림
- [ ] 이전 버전 앱에서 업데이트 배너 → "지금 업데이트" → 자동 재시작 후 새 버전
- [ ] 업데이트 후에도 이름·방·불씨·꾸미기가 그대로

### B. 창 · 화면 (실제 앱에서 처음 확인하는 것들)
- [ ] 제목 줄이 없고 창이 **투명**하다(지붕 모서리 뒤로 바탕화면이 보임)
- [ ] 방의 **어디를 잡아도** 창이 움직이고, 버튼·좌석 점·내 캐릭터는 눌린다(드래그가 시작되지 않음)
- [ ] 내리기 · 끄기 · 일반↔미니 전환이 된다
- [ ] 미니: 위쪽 얼굴 탭 밖은 투명하고, 아래 바에 이름·상태·프로그램이 보인다
- [ ] 핀을 켜면 채팅·상점 창도 항상 위에 뜬다
- [ ] 채팅·상점 창: 제목 줄을 잡고 끌 수 있고 내리기·끄기가 된다 (너비 304, 채팅 높이 320)
- [ ] 앱을 껐다 켜도 창 위치가 복원된다 / 화면 밖으로 나가 있지 않다
- [ ] 모니터가 둘일 때 경계에서 정상 (Windows는 배율 125%/150%에서 글자가 깨지지 않는지)

### C. 방 · 채팅 (2대)
- [ ] 방장: 방 만들기 → 코드 표시, 복사, 입장 허용 스위치, 코드 재발급
- [ ] 손님: 코드로 입장 → 양쪽 채팅에 "○○님이 입장하셨습니다"
- [ ] 채팅: 내 말풍선이 **바로** 뜨고 입력창이 즉시 비워진다, 시간 표시, 같은 사람·같은 분 묶음, 캐릭터 머리 위 말풍선 3초
- [ ] 좌석: 빈 자리 점을 눌러 앉기/내 캐릭터 눌러 일어나기, 같은 자리 동시 선택 시 한 명만 앉음
- [ ] 방장이 강퇴(사유 포함) → 손님 화면에 배너, 채팅 창이 닫히고 자기 방으로 복귀
- [ ] 정원 6명 초과 시 입장 거절
- [ ] 방장이 방 닫기 → 손님에게 "방장이 방을 닫았어요"

### D. 종료 · 연결 끊김
- [ ] 손님이 **끄기**로 종료 → 방장 채팅에 "퇴장하셨습니다"
- [ ] 방장이 **끄기**(또는 Cmd+Q)로 종료 → 손님이 "방이 닫혔어요"
- [ ] 손님 앱을 **강제 종료**(작업 관리자/활동 모니터) → 약 3분 뒤 퇴장 처리되고 정원 자리가 비워짐
- [ ] 인터넷을 끊었다 켜기 → ⚠가 떴다가 복구됨
- [ ] 오래 켜 둔 뒤(절전 후) 돌아오면 방에서 나가졌는지 안내가 뜨고 내 방으로 복귀

### E. 작업 시간 · 불씨 · 방 시계
- [ ] 처음 실행 때 프로그램 읽기 **동의 창**이 뜬다. 허용/거부 각각 동작, "프로그램 이름 공유"를 껐다 켜면 동의 창이 **다시** 뜬다
- [ ] 내 상태: 작업 시간 인정 **입력이 있으면** → 입력하고 있으면 1분에 불씨 1개씩(레벨 칩 숫자 증가)
- [ ] **등록한 프로그램만**: 처음엔 목록이 비어 있고, 쓰던 프로그램이 나타나 눌러 등록된다. 등록 프로그램 앞에서만 "지금 쌓이는 중", 유튜브 등에서는 "안 쌓여요"
- [ ] 두 명이 함께 작업하면 적립이 빨라진다(1분에 불씨 1.5개 → 화면은 내림이라 가끔 1씩 건너뜀)
- [ ] 우측 하단 시계: "기록"은 방 만든 뒤 시간, "작업"은 등록 모드일 때만 숫자
- [ ] 방 레벨: 시간 단계 변화(위 3번 SQL로 시간 앞당기기) — 촛불→전구→전등…, "방이 ○○ 단계가 됐어요!" 알림, 배경이 밝아짐
- [ ] 레벨 칩 마우스 오버 툴팁: `Lv.2 · 70/150불씨 · 80불씨 남음 · 보유 …`

### F. 꾸미기 · 상점
- [ ] 상점(가방 아이콘) → 옷장: 피부색·머리·머리색·옷·옷색·악세서리 선택이 바로 반영
- [ ] 잠긴 아이템: 레벨 부족이면 비활성, 불씨 부족이면 "불씨 부족", 충분하면 구매 확인 → 구매 후 자동 착용
- [ ] 꾸밈을 바꾸면 **상대 화면에서도** 바뀐다(상점 창에서 바꿔도 메인 창이 갱신)

### G. 찌르기 · 알림
- [ ] 상대를 찌르면: 개릿을 보고 있을 때는 배너 + 캐릭터 흔들림
- [ ] 다른 프로그램을 보고 있을 때는 **OS 알림**이 뜬다(처음 실행 때 알림 권한 허용). 미니 모드에서도 OS 알림
- [ ] 같은 사람을 30초 안에 다시 찌르면 막힌다(버튼에 남은 초 표시)

### H. 플랫폼별
- [ ] **Windows**: 작업 중/쉬는 중/자리 비움 판정, 프로그램 이름 감지(`chrome.exe` 등), 입력 감지 — *아직 한 번도 실행해 본 적 없음*
- [ ] **Mac**: 친구 Mac에서 프로그램 이름이 `[ NULL ]`이 아니라 실제 이름으로 보인다

### I. 보안 · 권한 (2번째 계정으로)
- [ ] 방장이 아닌 사람은 강퇴 버튼이 없고, 직접 호출해도 서버가 거절한다
- [ ] 방에 없는 사람을 찌르면 거절된다

### J. 계정 (구글 연결·로그인 — 설정은 `supabase/AUTH_SETUP.md`)
- [ ] 내 상태 → 계정 → **구글 계정 연결하기** → 브라우저 로그인 → "로그인이 끝났어요" 페이지 → 앱에 "연결했어요", 이름·불씨·꾸미기 그대로
- [ ] SQL로 내 계정이 `is_anonymous = false`, `provider = google`인지 확인(AUTH_SETUP.md의 C-2)
- [ ] **복구**: 앱 데이터를 지우거나 다른 컴퓨터에서 처음 화면 → "이미 계정이 있어요(구글로 로그인)" → 이전 계정이 그대로 돌아옴
- [ ] 이미 연결한 구글로 다시 "연결"하면 안내 문구가 뜬다 / 로그인 창을 3분 넘게 두면 "로그인 시간이 지났어요" / 취소 버튼
- [ ] Windows에서도 브라우저가 열리고 앱으로 돌아온다(`rundll32`로 여는 부분은 아직 실행해 본 적 없음)

## 5. 친구에게 보내는 설치 안내문 (복사해서 사용)

> 개릿 설치 방법
> 1. https://github.com/chazzeling/garite/releases 에서 내 컴퓨터에 맞는 파일을 받아요. Mac(M1 이후)은 `aarch64.dmg`, 인텔 Mac은 `x64.dmg`, Windows는 `.exe`예요.
> 2. Mac: dmg를 열어 앱을 Applications로 옮기고, 처음 열 때 경고가 뜨면 앱을 우클릭 → 열기. 그래도 안 열리면 터미널에서 `xattr -cr /Applications/garite.app`
> 3. Windows: 경고가 뜨면 "추가 정보 → 실행"
> 4. 처음 켜면 이름을 정하고, "프로그램 이름" 허용 창과 알림 권한이 나와요(허용해야 찌르기 알림을 받아요).
> 5. 이후 새 버전은 앱 안 배너의 "지금 업데이트"만 누르면 돼요.
