import { selectPinned, useWindowPrefs } from "../../store/windowPrefs";
import { useStatus } from "../../store/status";
import { Icon } from "./Icon";

export function WindowControls() {
  const mode = useWindowPrefs((s) => s.mode);
  const pinned = useWindowPrefs(selectPinned);
  const focus = useStatus((s) => s.mine.focusMode);
  const chatOpen = useWindowPrefs((s) => s.chatOpen);
  const { setMode, togglePin, toggleChat } = useWindowPrefs.getState();

  return (
    <div className="controls" data-tauri-drag-region>
      <button
        className="iconbtn"
        onClick={() => setMode(mode === "full" ? "mini" : "full")}
        title={mode === "full" ? "미니 모드로" : "일반 모드로"}
        aria-label={mode === "full" ? "미니 모드로" : "일반 모드로"}
      >
        <Icon name={mode === "full" ? "modeMini" : "modeFull"} />
      </button>
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
      <div className="icons winbtns">
        <button className="iconbtn" onClick={() => void useWindowPrefs.getState().minimize()} title="내리기" aria-label="내리기">
          <Icon name="minus" />
        </button>
        <button className="iconbtn" onClick={() => void useWindowPrefs.getState().close()} title="끄기" aria-label="끄기">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
