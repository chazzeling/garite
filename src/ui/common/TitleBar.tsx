import { useWindowPrefs } from "../../store/windowPrefs";
import { Icon } from "./Icon";

// 테두리 없는 보조 창(채팅 등)의 맨 위 줄: 도트 글꼴 제목 + 내리기·끄기. 빈 곳을 잡고 끌면 창이 움직인다.
export function TitleBar({ title }: { title: string }) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <b data-tauri-drag-region>{title}</b>
      <div className="icons">
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
