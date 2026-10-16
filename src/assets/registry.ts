// 그림이 생기면 sprites/ 폴더에 PNG를 넣는다 (규칙은 sprites/README.md). 코드는 건드리지 않는다.
// PNG가 있으면 그 그림을, 없으면 플레이스홀더(이모지·텍스트)를 쓴다 — 완성된 것부터 하나씩 바꿔 끼울 수 있다.
import items from "../config/items.json";
import stages from "../config/roomLevels.json";
import type { AvatarSpec, Motion, Pose, WorkState } from "../types";
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES } from "./avatar";

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

/**
 * 꾸민 캐릭터의 겹침 그림(아래→위: 몸, 옷, 머리, 악세서리). tint가 있는 층은 회색조로 그린 그림에 그 색을 곱해 입힌다.
 * 몸 그림(characters/body/…)이 없으면 null — 호출하는 쪽이 통짜 스프라이트나 임시 표시로 대신한다.
 * 옷·머리·악세서리는 그림이 있는 것만 겹친다 (일부만 그려도 동작).
 */
export type AvatarLayer = { image: SpriteImage; tint: string | null };

const partImage = (kind: string, id: string, motion: Motion, pose: Pose): SpriteImage | null =>
  first(
    ...(motion === "none" ? [] : [`characters/${kind}/${id}/${pose}-${motion}`]),
    `characters/${kind}/${id}/${pose}`,
  );

export function avatarLayers(a: AvatarSpec, motion: Motion, pose: Pose): AvatarLayer[] | null {
  const body = first(...(motion === "none" ? [] : [`characters/body/${pose}-${motion}`]), `characters/body/${pose}`);
  if (!body) return null;
  const layers: AvatarLayer[] = [{ image: body, tint: SKIN_TONES[a.skin] }];
  const add = (img: SpriteImage | null, tint: string | null) => img && layers.push({ image: img, tint });
  add(partImage("outfit", a.outfit, motion, pose), OUTFIT_COLORS[a.outfitColor]);
  add(partImage("hair", a.hair, motion, pose), HAIR_COLORS[a.hairColor]);
  if (a.accessory !== "none") add(partImage("accessory", a.accessory, motion, pose), null);
  return layers;
}

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

// 방 조명 단계(1~5)별로 배경을 바꾼다. 그림이 있으면 room/background-<단계>.png, 없으면 room/background.png,
// 그것도 없으면 단계마다 점점 밝아지는 단색(config/roomLevels.json의 color).
export const roomBackground = (level = 1) => ({
  color: stages.find((s) => s.level === level)?.color ?? "#e4def6",
  image: (first(`room/background-${level}`) ?? roomImage())?.url ?? null,
  width: ROOM_W,
  height: ROOM_H,
});
