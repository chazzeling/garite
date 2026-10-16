import { useState } from "react";
import { useMe } from "../../store/me";
import { useShownMembers } from "../../store/room";
import { MemberSection } from "./MemberSection";
import { RoomSection } from "./RoomSection";
import { StatusPanel } from "./StatusPanel";
import { WalletBar } from "./WalletBar";

type Tab = "room" | "status" | "members";

export function RoomPanel() {
  const status = useMe((s) => s.status);
  const count = useShownMembers().length;
  const [tab, setTab] = useState<Tab>("room");

  if (status !== "ready") return <div className="hint">서버에 연결되면 방 · 상점 · 설정을 쓸 수 있어요.</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "room", label: "방" },
    { id: "status", label: "내 상태" },
    { id: "members", label: `멤버 ${count}` },
  ];

  return (
    <div className="panel">
      <WalletBar />
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="tab-body">
        {tab === "room" && <RoomSection />}
        {tab === "status" && <StatusPanel />}
        {tab === "members" && <MemberSection />}
      </div>
    </div>
  );
}
