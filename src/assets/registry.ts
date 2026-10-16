// 그림이 생기면 sprites/ 폴더에 PNG를 넣는다 (규칙은 sprites/README.md). 코드는 건드리지 않는다.
// PNG가 있으면 그 그림을, 없으면 플레이스홀더(이모지·텍스트)를 쓴다 — 완성된 것부터 하나씩 바꿔 끼울 수 있다.
import items from "../config/items.json";
import type { Motion, Pose, WorkState } from "../types";

// ── 그림 파일 색인 ─────────────────────────────
// 파일명 끝의 @N 은 가로로 이어 붙인 프레임 수 (예: sit-typing@2.png = 16×16 프레임 2장)
export type SpriteImage = { url: string; frames: number };

const files = import.meta.glob("./sprites/**/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const index = new Map<string, SpriteImage>();
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/^\.\/sprites\/(.+?)(?:@(\d+))?\.png$/);
  if (m) index.set(m[1], { url, frames: Number(m[2] ?? 1) });
}
const first = (...keys: string[]) => {
  for (const k of keys) {
    const hit = index.get(k);
    if (hit) return hit;
  }
  return null;
};

/** 캐릭터 스프라이트(PNG). 아바타 전용 → 기본 아바타 순, 모션 → 정지 포즈 순으로 찾는다 */
export const characterImage = (avatarId: string, motion: Motion, pose: Pose): SpriteImage | null =>
  first(
    ...[avatarId, "default"].flatMap((a) => [
      ...(motion === "none" ? [] : [`characters/${a}/${pose}-${motion}`]),
      `characters/${a}/${pose}`,
    ]),
  );

export const itemImage = (itemId: string): SpriteImage | null => first(`items/${itemId}`);
export const faceImage = (avatarId: string): SpriteImage | null => first(`faces/${avatarId}`, "faces/default");
/** 쉬는 중·자리 비움 표시 (8×8). working은 없음 */
export const stateOverlayImage = (state: WorkState): SpriteImage | null =>
  state === "working" ? null : first(`overlays/${state}`);
const roomImage = (): SpriteImage | null => first("room/background");

// ── 플레이스홀더 ──────────────────────────────
const STATE_ICON: Record<WorkState, string> = {
  working: "🟢",
  idle: "💤",
  away: "🌙",
};

export const STATE_LABEL: Record<WorkState, string> = { working: "작업 중", idle: "쉬는 중", away: "자리 비움" };

const MOTION_ICON: Record<Motion, string> = { typing: "⌨️", drawing: "🎨", none: "" };

// 포즈는 좌석(config/seats.json)이 정한다: 침대=lie, 책상·러그=sit, 좌석 없음=stand.
const POSE_ICON: Record<Pose, string> = { stand: "", sit: "🪑", lie: "🛏️" };

export const characterSprite = (_avatarId: string, state: WorkState, motion: Motion, pose: Pose = "stand"): string =>
  POSE_ICON[pose] + STATE_ICON[state] + MOTION_ICON[motion];

export const itemSprite = (itemId: string): string => items.find((i) => i.id === itemId)?.name ?? itemId;

export const faceIcon = (_avatarId: string): string => "🙂";

// 방 그림 크기(px). 화면에서 정수 배율(×2 → 300×312)로 확대한다.
export const ROOM_W = 150;
export const ROOM_H = 156;
export const SPRITE_PX = 16; // 캐릭터 한 칸(16×16)

export const roomBackground = () => ({
  color: "#e4def6", // 플레이스홀더: 단색
  image: roomImage()?.url ?? null,
  width: ROOM_W,
  height: ROOM_H,
});
