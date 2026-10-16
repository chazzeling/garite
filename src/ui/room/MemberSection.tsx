import { useEffect, useState } from "react";
import cfg from "../../config/activity.json";
import { Icon } from "../common/Icon";
import { Sprite } from "../common/Sprite";
import { usePoke } from "../../store/poke";
import { characterSprite, faceImage, STATE_LABEL } from "../../assets/registry";
import { useMe } from "../../store/me";
import { useRoom, useShownMembers } from "../../store/room";
import { useFavorites } from "../../store/favorites";

const REASONS = ["자리 비움", "방 정리"];
const CUSTOM = "__custom";

export function MemberSection() {
  const userId = useMe((s) => s.userId);
  const ownerId = useRoom((s) => s.ownerId);
  const members = useShownMembers();
  const favorites = useFavorites((s) => s.list);
  const [kicking, setKicking] = useState<string | null>(null);
  const [preset, setPreset] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const sentAt = usePoke((s) => s.sentAt);
  const pokeNotice = usePoke((s) => s.notice);
  const [now, setNow] = useState(Date.now());
  const home = ownerId === userId;
  const left = (id: string) => Math.max(0, Math.ceil(((sentAt[id] ?? 0) + cfg.pokeCooldownSeconds * 1000 - now) / 1000));

  // 쿨다운 표시를 위해 찌른 직후에만 1초마다 갱신
  const cooling = Object.keys(sentAt).some((id) => left(id) > 0);
  useEffect(() => {
    if (!cooling) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooling]); // 방장만 강퇴 버튼이 보인다 (실제 권한은 서버가 검증)

  return (
    <ul className="members">
      {members.map((m) => (
        <li key={m.userId}>
          <div className="member-row">
            <span className="face">{faceImage(m.avatarId) ? <Sprite image={faceImage(m.avatarId)!} w="32px" h="32px" /> : characterSprite(m.avatarId, m.state, m.motion)}<i className={`dot ${m.state}`} /></span>
            <span className="member-name">
              {m.name}
              {m.userId === ownerId && <span title="방장"> 👑</span>}
              <small>{m.customText ?? m.appLabel ?? STATE_LABEL[m.state]}</small>
            </span>
            {m.userId !== userId && (
              <button
                className="ghost sm"
                title={favorites.some((f) => f.userId === m.userId) ? "자주 가는 방에서 빼기" : "자주 가는 방에 저장 (이 친구의 방으로 바로 입장)"}
                aria-pressed={favorites.some((f) => f.userId === m.userId)}
                onClick={() => useFavorites.getState().toggle(m.userId, m.name)}
              >
                {favorites.some((f) => f.userId === m.userId) ? "★" : "☆"}
              </button>
            )}
            {m.userId !== userId && (
              <button
                className="ghost sm"
                disabled={left(m.userId) > 0}
                title="딴짓하면 찔러서 알려줘요"
                onClick={() => { setNow(Date.now()); void usePoke.getState().poke(m.userId); }}
              >
                <Icon name="bell" size={12} /> {left(m.userId) > 0 ? `${left(m.userId)}초` : "찌르기"}
              </button>
            )}
            {home && m.userId !== userId && (
              <button className="ghost danger-text sm" onClick={() => setKicking(kicking === m.userId ? null : m.userId)}>
                강퇴
              </button>
            )}
          </div>
          {kicking === m.userId && (
            <form
              className="kick"
              onSubmit={(e) => {
                e.preventDefault();
                const text = (preset === CUSTOM ? custom : preset).trim();
                if (!text) return;
                void useRoom.getState().kick(m.userId, text);
                setKicking(null);
                setCustom("");
              }}
            >
              <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
                <option value={CUSTOM}>직접 입력</option>
              </select>
              {preset === CUSTOM && (
                <input value={custom} maxLength={30} placeholder="사유" onChange={(e) => setCustom(e.target.value)} />
              )}
              <button className="danger sm">확인</button>
            </form>
          )}
        </li>
      ))}
      {members.length === 0 && <li className="hint">아직 아무도 없어요.</li>}
      {pokeNotice && <li className="err">{pokeNotice}</li>}
    </ul>
  );
}
