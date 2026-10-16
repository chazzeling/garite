import { useEffect } from "react";
import slots from "../../config/slots.json";
import { itemImage, itemSprite, roomBackground } from "../../assets/registry";
import { Sprite } from "../common/Sprite";
import { useChat } from "../../store/chat";
import { useEconomy } from "../../store/economy";
import { usePoke } from "../../store/poke";
import { useMe } from "../../store/me";
import { useRoom, useShownMembers } from "../../store/room";
import { Character } from "./Character";
import { useRoomLight } from "./useRoomLight";
import { availableSeats, resolveSeats, SEATS, STAND_Y } from "./seating";

// 플레이스홀더 방: 슬롯 위치에 이름 텍스트 박스, 캐릭터는 이모지
export function RoomScene() {
  const light = useRoomLight();
  const bg = roomBackground(light.stage.level);
  const shown = useShownMembers();
  const bubbles = useChat((s) => s.bubbles);
  const ownerId = useRoom((s) => s.ownerId);
  const userId = useMe((s) => s.userId);
  const poked = usePoke((s) => s.incoming?.nonce); // 찔렸을 때 내 캐릭터가 흔들린다
  const equipped = useEconomy((s) => s.sceneEquipped);
  const mineEquipped = useEconomy((s) => s.equipped);

  // 방장의 꾸밈을 보여준다 (방을 옮기거나 내 장착이 바뀌면 다시 읽음)
  useEffect(() => {
    void useEconomy.getState().loadScene(ownerId);
  }, [ownerId, mineEquipped]);

  const seats = availableSeats(equipped);
  const seated = resolveSeats(shown, seats);
  const takenBy = new Map<string, string>(); // seatId → userId
  for (const [uid, sid] of seated) if (sid) takenBy.set(sid, uid);

  // 같은 자리를 동시에 골라 졌다면 내 쪽에서도 자리를 비운다
  const mine = shown.find((m) => m.userId === userId);
  const lostSeat = !!mine?.seat && seats.some((s) => s.id === mine.seat) && seated.get(mine.userId) === null;
  useEffect(() => {
    if (lostSeat) useRoom.getState().setSeat(null);
  }, [lostSeat]);

  const standing = shown.filter((m) => !seated.get(m.userId));

  return (
    <div className="room-wrap"><div className="room-frame" data-tauri-drag-region>
    <div
      className="room"
      data-tauri-drag-region="deep"
      style={{
        background: bg.image ? `url(${bg.image}) center / 100% 100% no-repeat, ${bg.color}` : bg.color,
      }}
    >
      {slots.filter((s) => equipped[s.id]).map((s) => (
        <div
          key={s.id}
          className={`slot cat-${s.category}`}
          style={{
            left: `${(s.x / bg.width) * 100}%`,
            top: `${(s.y / bg.height) * 100}%`,
            width: `${(s.w / bg.width) * 100}%`,
            height: `${(s.h / bg.height) * 100}%`,
            zIndex: s.z,
          }}
        >
          {itemImage(equipped[s.id]) ? (
            <Sprite image={itemImage(equipped[s.id])!} w="100%" h="100%" />
          ) : (
            <span>{itemSprite(equipped[s.id])}</span>
          )}
        </div>
      ))}
      {/* 비어 있는 좌석: 눌러서 앉기 / 눕기 */}
      {seats.filter((seat) => !takenBy.has(seat.id)).map((seat) => (
        <button
          key={seat.id}
          className="seat-spot"
          title={seat.pose === "lie" ? "눕기" : "앉기"}
          style={{
            left: `${(seat.x / bg.width) * 100}%`,
            top: `${(seat.y / bg.height) * 100}%`,
            zIndex: (slots.find((s) => s.id === seat.slotId)?.z ?? 0) + 1,
          }}
          onClick={() => useRoom.getState().setSeat(seat.id)}
        />
      ))}
      {shown.map((m) => {
        const seat = SEATS.find((x) => x.id === seated.get(m.userId));
        const slot = seat && slots.find((s) => s.id === seat.slotId);
        if (seat && slot) {
          return (
            <Character
              key={m.userId}
              member={m}
              bubble={bubbles[m.userId]?.text}
              left={(seat.x / bg.width) * 100}
              top={(seat.y / bg.height) * 100}
              z={slot.z + 1}
              pose={seat.pose}
              shakeKey={m.userId === userId ? poked : undefined}
              onClick={m.userId === userId ? () => useRoom.getState().setSeat(null) : undefined}
            />
          );
        }
        const i = standing.indexOf(m);
        return (
          <Character
            key={m.userId}
            member={m}
            bubble={bubbles[m.userId]?.text}
            left={standing.length === 1 ? 50 : 10 + (i * 80) / (standing.length - 1)}
            top={(STAND_Y / bg.height) * 100}
            z={50}
            pose="stand"
            shakeKey={m.userId === userId ? poked : undefined}
          />
        );
      })}
    </div>
    </div></div>
  );
}
