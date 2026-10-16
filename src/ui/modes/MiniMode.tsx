import { useEffect } from "react";
import { Sprite } from "../common/Sprite";
import { MiniAlert } from "../common/MiniAlert";
import { WindowControls } from "../common/WindowControls";
import { faceIcon, faceImage, STATE_LABEL } from "../../assets/registry";
import { useRoom, useShownMembers } from "../../store/room";
import { useWindowPrefs } from "../../store/windowPrefs";

// 두 줄: 위는 얼굴 탭(투명 배경), 아래는 이름·상태·프로그램 바. 테두리 없음 → 드래그 영역 지정
export function MiniMode() {
  const members = useShownMembers();
  const connection = useRoom((s) => s.connection);

  useEffect(() => {
    void useWindowPrefs.getState().fitMini(members.length);
  }, [members.length]);

  return (
    <div className="mini">
      {/* 위 줄: 얼굴 탭(인덱스처럼 솟음). 탭 밖은 투명 */}
      <div className="mini-faces" data-tauri-drag-region>
        {members.map((m) => (
          <div key={m.userId} className="mini-tab" data-tauri-drag-region>
            <span className={`face-tab ${m.state}`} title={m.name}>
              {faceImage(m.avatarId) ? <Sprite image={faceImage(m.avatarId)!} w="32px" h="32px" /> : faceIcon(m.avatarId)}
            </span>
          </div>
        ))}
        <MiniAlert />
      </div>
      {/* 아래 줄: 이름·상태 / 쓰는 프로그램 */}
      <div className="mini-bar" data-tauri-drag-region>
        <span className="mini-members" data-tauri-drag-region>
          {connection === "error" && "⚠ "}
          {members.map((m) => (
            <span key={m.userId} className="mini-member" data-tauri-drag-region>
              <span className="top" data-tauri-drag-region>
                <i className={`dot ${m.state}`} />
                <span className="nm" title={`${m.name} · ${STATE_LABEL[m.state]}`}>{m.name}</span>
              </span>
              <span className="sub" data-tauri-drag-region title={m.customText ?? m.appLabel ?? ""}>{m.customText ?? m.appLabel ?? ""}</span>
            </span>
          ))}
        </span>
        <WindowControls />
      </div>
    </div>
  );
}
