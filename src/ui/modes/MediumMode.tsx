import { RoomScene } from "../room/RoomScene";
import { WindowControls } from "../common/WindowControls";

export function MediumMode() {
  return (
    <div className="medium">
      <header>
        <WindowControls />
      </header>
      <RoomScene />
    </div>
  );
}
