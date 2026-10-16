import { avatarLayers, characterImage, characterSprite } from "../../assets/registry";
import { decodeAvatar } from "../../assets/avatar";
import type { Motion, Pose, WorkState } from "../../types";
import { Sprite } from "./Sprite";

// 꾸민 캐릭터 한 명. 겹침 그림 → 통짜 스프라이트(characters/default) → 임시 표시(이모지) 순으로 그린다.
export function AvatarSprite({ avatarId, state, motion, pose, size = "100%" }: { avatarId: string; state: WorkState; motion: Motion; pose: Pose; size?: string }) {
  const layers = avatarLayers(decodeAvatar(avatarId), motion, pose);
  if (layers) {
    return (
      <span className="avatar" style={{ width: size, height: size }}>
        {layers.map((l, i) => (
          <Sprite key={i} image={l.image} tint={l.tint} w="100%" h="100%" className="layer" />
        ))}
      </span>
    );
  }
  const whole = characterImage(avatarId, motion, pose);
  if (whole) return <Sprite image={whole} w={size} h={size} />;
  return <>{characterSprite(avatarId, state, motion, pose)}</>;
}
