import { useEffect } from "react";
import { Sprite } from "../common/Sprite";
import { WindowControls } from "../common/WindowControls";
import { faceIcon, faceImage, STATE_LABEL } from "../../assets/registry";
import { useRoom, useShownMembers } from "../../store/room";
import { useWindowPrefs } from "../../store/windowPrefs";

// 한 줄: [얼굴 + 상태 + 한 줄 문구] × 멤버 수. 테두리 없음 → 드래그 영역 지정
export function MiniMode() {
  const members = useShownMembers();
  const connection = useRoom((s) => s.connection);

  useEffect(() => {
    void useWindowPrefs.getState().fitMini(members.length);
  }, [members.length]);

  return (
    <div className="mini" data-tauri-drag-region>
      <span className="mini-members" data-tauri-drag-region>
        {connection === "error" && "⚠ "}
        {members.map((m) => (
          <span key={m.userId} className="mini-member" data-tauri-drag-region>
            <span className="face" data-tauri-drag-region>{faceImage(m.avatarId) ? <Sprite image={faceImage(m.avatarId)!} w="32px" h="32px" /> : faceIcon(m.avatarId)}</span>
            <span className="lines" data-tauri-drag-region>
              <span className="top" data-tauri-drag-region>
                <i className={`dot ${m.state}`} />
                {m.name}
                <em>{STATE_LABEL[m.state]}</em>
              </span>
              <span className="sub" data-tauri-drag-region>{m.customText ?? m.appLabel ?? ""}</span>
            </span>
          </span>
        ))}
      </span>
      <WindowControls />
    </div>
  );
}
