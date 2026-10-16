# 도트 그림 가이드

PNG를 이 폴더에 **아래 이름으로 넣기만 하면** 앱이 자동으로 씁니다(코드 수정 없음).
파일이 없는 것은 지금처럼 임시 표시(이모지·글자)로 나오므로, 완성된 것부터 하나씩 넣어도 됩니다.

## 기본 규칙

| 항목 | 규칙 |
|---|---|
| 형식 | PNG, **투명 배경**, 안티앨리어싱·그림자 번짐 없이(도트는 경계가 딱 떨어지게) |
| 크기 | **확대하지 않은 원본 크기**로 저장. 앱이 정수 배율(×2)로 키워 보여줍니다 |
| 방 그림 | **150×156** → 화면 300×312 (정확히 2배) |
| 캐릭터 | **16×16** 한 칸. **발이 아래 가운데**에 오게 그리기(좌석 위치가 발 기준) |
| 팔레트 | 16~32색 권장, 외곽선 1px, 빛은 왼쪽 위에서 — 처음에 정해 두면 전체가 통일됩니다 |
| 도구 | Aseprite(유료), LibreSprite·Piskel(무료). 프레임 여러 장은 **가로로 이어 붙인 한 장**으로 내보내기 |

## 파일 목록 (이름 = 규칙)

```
room/background.png                 150×156   방 배경(벽+바닥)
characters/default/stand.png        16×16     서 있기
characters/default/sit.png          16×16     앉기 (책상·러그)
characters/default/lie.png          16×16     눕기 (침대)
characters/default/sit-typing@2.png 32×16     앉아서 타자 (16×16 프레임 2장)
characters/default/sit-drawing@2.png
characters/default/lie-typing@2.png           침대에서 타자(노트북) 등 필요한 만큼
characters/<아바타id>/...           같은 규칙. 없는 파일은 default 것을 대신 씁니다
faces/default.png                   16×16     얼굴(멤버 목록·미니 모드)
overlays/idle.png                   8×8       "쉬는 중" 표시(머리 위에 얹음)
overlays/away.png                   8×8       "자리 비움" 표시
items/<아이템id>.png                슬롯 크기  가구·소품 (아래 표)
```

- 파일명 끝 `@N` 은 **프레임 수**입니다(`sit-typing@2.png` = 프레임 2장, 0.25초 간격 반복).
- 모션이 없는 상태는 `포즈.png`(정지 그림)을 씁니다. 모션 그림이 없으면 정지 그림으로 대신합니다.
- **작업 중 / 쉬는 중 / 자리 비움은 캐릭터를 따로 그리지 않습니다.** 쉬는 중·자리 비움은 `overlays/`의 8×8 아이콘이 머리 위에 얹힙니다.

## 아이템 크기 (같은 카테고리는 크기가 같음)

`config/slots.json` 의 `w`×`h` 가 그림 크기입니다. 크기를 바꾸고 싶으면 그 파일의 숫자를 고치면 됩니다.

| 카테고리 | 크기 | 아이템 id |
|---|---|---|
| bed | 41×41 | bed-basic, bed-quilt |
| desk | 38×37 | desk-basic, desk-wood |
| shelf | 24×37 | shelf-basic |
| deco | 14×14 | deco-plant, deco-lamp |
| rug | 49×34 | rug-basic, rug-round |

위치(좌표)는 `config/slots.json`, 앉는 자리는 `config/seats.json` 에 있습니다(둘 다 150×156 그림 기준 픽셀).
가구 그림을 그린 뒤 캐릭터가 어색하게 앉아 있으면 `seats.json` 의 `x`,`y`(=발 위치)만 조금씩 옮기면 됩니다.

## 만드는 순서 (권장)

1. 팔레트·외곽선 규칙 정하기
2. 방 배경 1장
3. 캐릭터 기본 자세 3개 (stand, sit, lie)
4. 레벨 1 무료 가구 3개 (bed-basic, desk-basic, rug-basic)
5. 얼굴 아이콘, 상태 아이콘(idle, away)
6. 움직임 프레임: sit-typing, sit-drawing, lie-typing 순서로 각 2프레임
7. 나머지 가구 6개, 이후 옷장(캐릭터 꾸미기) 아이템

## 겹침 순서

- 방 안 겹침은 슬롯의 `z` 값으로 고정(러그 1 < 선반 5 < 소품 6 < 침대 10 < 책상 20). 캐릭터는 앉은 가구보다 한 칸 위입니다.
- 그래서 책상 그림은 **의자·책상이 비어 있는 상태**로 그리고, 앉은 캐릭터가 그 위에 얹힌다고 생각하고 그리세요.
