import { characterImage, characterSprite, stateOverlayImage } from "../../assets/registry";
import { Sprite } from "../common/Sprite";
import type { MemberStatus, Pose } from "../../types";
import { SpeechBubble } from "./SpeechBubble";

export function Character({ member, bubble, left, top, z, pose, onClick, shakeKey }: { member: MemberStatus; bubble?: string; left: number; top: number; z: number; pose: Pose; onClick?: () => void; shakeKey?: number }) {
  const image = characterImage(member.avatarId, member.motion, pose);
  const overlay = stateOverlayImage(member.state);
  return (
    <div className={`character ${onClick ? "me" : ""}`} title={onClick ? "일어나기" : undefined} onClick={onClick} style={{ left: `${left}%`, top: `${top}%`, zIndex: z }}>
      {bubble && <SpeechBubble text={bubble} />}
      <div className={`sprite ${shakeKey ? "shake" : ""}`} key={shakeKey ?? 0}>
        {image ? <Sprite image={image} w="100%" h="100%" /> : characterSprite(member.avatarId, member.state, member.motion, pose)}
      </div>
      {overlay && <Sprite image={overlay} w="calc(8 * var(--px))" h="calc(8 * var(--px))" className="overlay" />}
      <div className="nick">
        <i className={`dot ${member.state}`} />
        {member.name}
      </div>
      {(member.customText ?? member.appLabel) && <div className="label">{member.customText ?? member.appLabel}</div>}
    </div>
  );
}
