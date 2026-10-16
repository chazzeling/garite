import { useMe } from "../../store/me";
import { useShownMembers } from "../../store/room";
import { Icon } from "../common/Icon";
import { MemberSection } from "./MemberSection";
import { RoomSection } from "./RoomSection";
import { StatusPanel } from "./StatusPanel";

// 방 위로 올라오는 패널(시트). 열고 닫는 버튼은 하단 컨트롤 줄에 있다.
// "방" 시트는 방 코드·입장 설정 + 멤버 목록을 함께 보여준다.
export type PanelTab = "room" | "status";

const TITLES: Record<PanelTab, string> = { room: "방 · 멤버", status: "내 상태" };

export function PanelSheet({ tab, onClose }: { tab: PanelTab; onClose: () => void }) {
  const status = useMe((s) => s.status);
  const count = useShownMembers().length;
  return (
    <section className="sheet" aria-label={TITLES[tab]}>
      <div className="sheet-head">
        <b>{TITLES[tab]}</b>
        <button className="iconbtn" onClick={onClose} aria-label="닫기" title="닫기">
          <Icon name="close" />
        </button>
      </div>
      <div className="sheet-body">
        {status !== "ready" ? (
          <p className="hint">서버에 연결되면 방 · 상점 · 설정을 쓸 수 있어요.</p>
        ) : tab === "room" ? (
          <div className="stack">
            <RoomSection />
            <div className="card-title">멤버 {count}</div>
            <MemberSection />
          </div>
        ) : (
          <StatusPanel />
        )}
      </div>
    </section>
  );
}
