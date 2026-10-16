import { selectPinned, useWindowPrefs } from "../../store/windowPrefs";
import { useStatus } from "../../store/status";
import { useChat } from "../../store/chat";
import { useShownMembers } from "../../store/room";
import { Icon } from "../common/Icon";
import type { PanelTab } from "./RoomPanel";

// 일반 모드의 조작은 전부 이 한 줄에 모은다. 세 묶음(구분선으로 나뉨):
//   ① 방(+멤버) · 내 상태 · 상점   ② 채팅 · 집중 · 핀   ③ 모드 전환 · 내리기 · 끄기
export function ControlBar({ open, onSelect }: { open: PanelTab | null; onSelect: (tab: PanelTab | null) => void }) {
  const mode = useWindowPrefs((s) => s.mode);
  const pinned = useWindowPrefs(selectPinned);
  const chatOpen = useWindowPrefs((s) => s.chatOpen);
  const unread = useChat((s) => s.unread);
  const focus = useStatus((s) => s.mine.focusMode);
  const count = useShownMembers().length;
  const { setMode, togglePin, toggleChat, openShop, minimize, close } = useWindowPrefs.getState();
  const toggleSheet = (tab: PanelTab) => onSelect(open === tab ? null : tab);

  return (
    <div className="controls" data-tauri-drag-region>
      <div className="icons">
        <button className={`iconbtn ${open === "room" ? "on" : ""}`} onClick={() => toggleSheet("room")} title={`방 · 멤버 ${count}`} aria-label="방과 멤버" aria-pressed={open === "room"}>
          <Icon name="door" />
        </button>
        <button className={`iconbtn ${open === "status" ? "on" : ""}`} onClick={() => toggleSheet("status")} title="내 상태" aria-label="내 상태" aria-pressed={open === "status"}>
          <Icon name="user" />
        </button>
        <button className="iconbtn" onClick={() => void openShop()} title="상점" aria-label="상점">
          <Icon name="bag" />
        </button>
      </div>
      <div className="icons">
        <button className={`iconbtn ${chatOpen ? "on" : ""}`} onClick={() => { useChat.getState().clearUnread(); void toggleChat(); }} title={unread ? "채팅창 · 새 메시지" : "채팅창"} aria-label={unread ? "채팅창, 새 메시지 있음" : "채팅창"} aria-pressed={chatOpen}>
          <Icon name="chat" />
          {unread && <i className="dot-badge" />}
        </button>
        <button className={`iconbtn ${focus ? "on" : ""}`} onClick={useStatus.getState().toggleFocus} title="집중 모드" aria-label="집중 모드" aria-pressed={focus}>
          <Icon name="target" />
        </button>
        <button className={`iconbtn ${pinned ? "on" : ""}`} onClick={togglePin} title="모든 창 위에 고정" aria-label="모든 창 위에 고정" aria-pressed={pinned}>
          <Icon name="pin" />
        </button>
      </div>
      <div className="icons">
        <button className="iconbtn" onClick={() => setMode(mode === "full" ? "mini" : "full")} title="미니 모드로" aria-label="미니 모드로">
          <Icon name="modeMini" />
        </button>
        <button className="iconbtn" onClick={() => void minimize()} title="내리기" aria-label="내리기">
          <Icon name="minus" />
        </button>
        <button className="iconbtn" onClick={() => void close()} title="끄기" aria-label="끄기">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
