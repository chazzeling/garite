import { selectPinned, useWindowPrefs } from "../../store/windowPrefs";
import { useStatus } from "../../store/status";
import type { WindowMode } from "../../types";
import { Icon, type IconName } from "./Icon";

const MODES: { id: WindowMode; label: string; icon: IconName }[] = [
  { id: "full", label: "최대", icon: "modeFull" },
  { id: "medium", label: "중간", icon: "modeMedium" },
  { id: "mini", label: "미니", icon: "modeMini" },
];

export function WindowControls() {
  const mode = useWindowPrefs((s) => s.mode);
  const pinned = useWindowPrefs(selectPinned);
  const focus = useStatus((s) => s.mine.focusMode);
  const chatOpen = useWindowPrefs((s) => s.chatOpen);
  const { setMode, togglePin, toggleChat } = useWindowPrefs.getState();

  return (
    <div className="controls">
      <div className="seg" role="group" aria-label="창 크기">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? "active" : ""} onClick={() => setMode(m.id)} title={`${m.label} 모드`} aria-label={`${m.label} 모드`} aria-pressed={mode === m.id}>
            <Icon name={m.icon} />
          </button>
        ))}
      </div>
      <div className="icons">
        <button className={`iconbtn ${focus ? "on" : ""}`} onClick={useStatus.getState().toggleFocus} title="집중 모드" aria-pressed={focus}>
          <Icon name="target" />
        </button>
        <button className={`iconbtn ${pinned ? "on" : ""}`} onClick={togglePin} title="모든 창 위에 고정" aria-pressed={pinned}>
          <Icon name="pin" />
        </button>
        <button className={`iconbtn ${chatOpen ? "on" : ""}`} onClick={toggleChat} title="채팅창" aria-pressed={chatOpen}>
          <Icon name="chat" />
        </button>
      </div>
    </div>
  );
}
