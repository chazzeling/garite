// 캐릭터 꾸미기 데이터: 팔레트, 기본값, avatarId 문자열 ↔ AvatarSpec 변환.
// avatarId 형식: v1.{피부}.{머리}.{머리색}.{옷}.{옷색}.{악세서리}  예) v1.1.hair-short.0.outfit-tee.9.none
// (프로필에 저장되고 Presence로 친구에게 공유된다. 서버는 마이그레이션 0009에서 형식·해금 여부를 검증한다)
import cfg from "../config/avatar.json";
import type { AvatarSpec } from "../types";

export const SKIN_TONES = cfg.skin;
export const HAIR_COLORS = cfg.hairColors;
export const OUTFIT_COLORS = cfg.outfitColors;
export const DEFAULT_AVATAR: AvatarSpec = cfg.defaults;

const clamp = (n: number, len: number, fallback: number) => (Number.isInteger(n) && n >= 0 && n < len ? n : fallback);

export function encodeAvatar(a: AvatarSpec): string {
  return `v1.${a.skin}.${a.hair}.${a.hairColor}.${a.outfit}.${a.outfitColor}.${a.accessory}`;
}

/** 알 수 없는 값(예전 "default" 등)은 기본값으로 */
export function decodeAvatar(id: string | null | undefined): AvatarSpec {
  const p = (id ?? "").split(".");
  if (p.length !== 7 || p[0] !== "v1") return DEFAULT_AVATAR;
  const d = DEFAULT_AVATAR;
  return {
    skin: clamp(Number(p[1]), SKIN_TONES.length, d.skin),
    hair: p[2] || d.hair,
    hairColor: clamp(Number(p[3]), HAIR_COLORS.length, d.hairColor),
    outfit: p[4] || d.outfit,
    outfitColor: clamp(Number(p[5]), OUTFIT_COLORS.length, d.outfitColor),
    accessory: p[6] || "none",
  };
}
