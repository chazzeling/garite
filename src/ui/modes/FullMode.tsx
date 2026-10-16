import { RoomScene } from "../room/RoomScene";
import { WindowControls } from "../common/WindowControls";
import { RoomPanel } from "../room/RoomPanel";

export function FullMode() {
  return (
    <div className="full">
      <header>
        <WindowControls />
      </header>
      <div className="body">
        <RoomScene />
        <aside><RoomPanel /></aside>
      </div>
    </div>
  );
}
