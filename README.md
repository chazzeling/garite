# 개릿 (garite)

친구들과 같은 방에 모여 작업하는 가벼운 데스크탑 앱이에요.
감시가 아니라 **"내가 지금 작업 중"이 자연스럽게 보여서 스스로 집중하게 되는 것**, 그리고 보는 재미가 목적이에요.

- 방 코드로 친구가 입장 → 캐릭터가 작업 중 / 쉬는 중 / 자리 비움을 보여줘요
- 작업한 시간만큼 불씨가 쌓이고, 방이 점점 환해져요 (아이템·옷 해금)
- 채팅(머리 위 말풍선), 찌르기, 하루 작업 목표 보너스
- 화면 공유·스크린샷은 없어요. 프로그램 이름 공유는 끌 수 있어요.

Tauri v2 + React + TypeScript + Zustand + Supabase(무료 플랜)로 만들었어요. Windows · macOS.

## 설치 (친구용)

[Releases](../../releases)에서 운영체제에 맞는 파일을 받아 설치하세요. 이후 업데이트는 앱 안에서 버튼 한 번이에요.
macOS에서 "손상된 파일" 경고가 뜨면 [RELEASE.md](RELEASE.md)의 안내를 따르세요.

## 개발

필요: Node 22+, Rust(stable), [Tauri 사전 준비물](https://tauri.app/start/prerequisites/)

```bash
npm install
cp .env.example .env.local   # 아래 환경 변수를 채우기
npm run tauri dev
```

환경 변수(`.env.local`, 커밋하지 않음):

| 이름 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | anon 공개 키 (RLS가 권한을 지켜요) |

서버: `supabase/migrations/`의 SQL을 번호 순서대로 SQL Editor에서 실행하세요. 구글 로그인 설정은 [supabase/AUTH_SETUP.md](supabase/AUTH_SETUP.md).

## 점검

```bash
npm run typecheck                          # 타입 검사
npm test                                   # 순수 로직(src/activity) + 클라이언트/서버 카탈로그 일치 검사
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 단위 테스트
```

푸시·PR마다 GitHub Actions(`ci.yml`)가 위 세 가지와 웹 빌드를 돌려요.
서버 SQL은 자동 테스트가 없어요. 마이그레이션을 바꾸면 [RELEASE.md](RELEASE.md)의 DB 확인 SQL로 확인하세요.

## 구조

```
src-tauri/   Rust: 유휴 시간 · 활성 프로그램 · 창/업데이트/자동 실행 플러그인
src/
  app/       창 모드, 엔트리(main · chat · shop)
  ui/        React 컴포넌트 (store 액션만 호출)
  store/     Zustand 상태
  net/       Supabase 통신 (UI를 모름)
  activity/  원시 신호 → 상태·모션 판정 (순수 함수)
  assets/    에셋 레지스트리 (그림은 여기서만 꺼냄)
  config/    아이템 · 슬롯 · 레벨 · 목표 · 임계값
supabase/    마이그레이션(테이블 · RLS · RPC)
```

권한이 필요한 동작(강퇴, 시스템 메시지, 해금, 보너스)은 클라이언트가 직접 쓰지 않고 서버 RPC로만 처리해요.
자세한 설계와 결정 기록은 [CLAUDE.md](CLAUDE.md), 배포 절차는 [RELEASE.md](RELEASE.md).

## 배포

`node scripts/release.mjs <버전>` → 태그 push → GitHub Actions가 빌드하고 Release에 올려요. 자세한 순서(DB 먼저, 앱 나중)는 [RELEASE.md](RELEASE.md).
