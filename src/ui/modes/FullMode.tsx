import { useState } from "react";
import { RoomScene } from "../room/RoomScene";
import { ControlBar } from "../room/ControlBar";
import { Hud } from "../room/Hud";
import { PanelSheet, type PanelTab } from "../room/RoomPanel";
import { RoomClock } from "../room/RoomClock";
import { useEconomy } from "../../store/economy";

// 일반 모드: 창 전체가 방(지붕 모양). 위 가운데에는 레벨 칩 하나, 조작은 전부 하단 컨트롤 줄 한 곳에 모여 있다.
// 방의 아무 곳이나 잡고 끌면 창이 움직인다(버튼·클릭 가능한 것은 제외).
export function FullMode() {
  const [open, setOpen] = useState<PanelTab | null>(null);
  const workMinutes = useEconomy((s) => s.roomWorkMinutes);
  return (
    <div className="full">
      <div className="stage">
        <RoomScene />
        <Hud />
        <RoomClock workMinutes={workMinutes} />
        {open && <PanelSheet tab={open} onClose={() => setOpen(null)} />}
        <div className="stage-bar">
          <ControlBar open={open} onSelect={setOpen} />
        </div>
      </div>
    </div>
  );
}
