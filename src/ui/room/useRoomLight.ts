import { useEffect, useState } from "react";
import { roomStageOf } from "../../activity/roomLevel";
import { useEconomy } from "../../store/economy";
import { useRoom } from "../../store/room";

/** 지금 방의 기록 시간(분)과 조명 단계. 서버가 준 방 나이에 흐른 시간을 더해 30초마다 갱신. 방이 없으면 첫 단계 */
export function useRoomLight() {
  const age = useEconomy((s) => s.roomAge);
  const ownerId = useRoom((s) => s.ownerId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const hasRoom = !!age && ownerId !== null;
  const minutes = hasRoom ? Math.max(0, Math.floor((age.seconds + (now - age.at) / 1000) / 60)) : 0;
  return { hasRoom, minutes, ...roomStageOf(minutes) };
}
