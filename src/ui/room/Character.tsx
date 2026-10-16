import { stateOverlayImage } from "../../assets/registry";
import { AvatarSprite } from "../common/AvatarSprite";
import { Sprite } from "../common/Sprite";
import type { MemberStatus, Pose } from "../../types";
import { SpeechBubble } from "./SpeechBubble";

export function Character({ member, bubble, left, top, z, pose, onClick, shakeKey }: { member: MemberStatus; bubble?: string; left: number; top: number; z: number; pose: Pose; onClick?: () => void; shakeKey?: number }) {
  const overlay = stateOverlayImage(member.state);
  return (
    <div
      className={`character ${onClick ? "me" : ""}`}
      title={onClick ? "일어나기" : undefined}
      onClick={onClick}
      {...(onClick ? { role: "button", tabIndex: 0 } : {})} /* 클릭 가능한 것은 드래그가 시작되지 않게 */
      style={{ left: `${left}%`, top: `${top}%`, zIndex: z }}>
      {bubble && <SpeechBubble text={bubble} />}
      <div className={`sprite ${shakeKey ? "shake" : ""}`} key={shakeKey ?? 0}>
        <AvatarSprite avatarId={member.avatarId} state={member.state} motion={member.motion} pose={pose} />
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
