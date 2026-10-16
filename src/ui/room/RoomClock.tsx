import { useEffect, useRef, useState } from "react";
import { useWorkPrefs } from "../../store/workPrefs";
import { Icon, type IconName } from "../common/Icon";
import { useShownMembers } from "../../store/room";
import { useRoomLight } from "./useRoomLight";

const hm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const hmText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

// 방 시계(시:분 두 줄) + 방의 조명 단계 + (둘 이상일 때) 방에 있는 사람 수 — 숫자 뱃지 대신 조용한 글자로. 기록 = 방을 만든 뒤 지난 시간(어떤 인정 방식이든 표시),
// 작업 = 이 방에서 내가 "등록한 프로그램만" 모드로 쌓은 시간(그 모드가 아니면 --:--).
// 조명 단계(촛불→전구→전등→샹들리에→별빛)는 개인 레벨과 무관하게 기록 시간으로만 정해져 모두에게 같다.
export function RoomClock({ workMinutes }: { workMinutes: number }) {
  const mode = useWorkPrefs((s) => s.mode);
  const light = useRoomLight();
  const people = useShownMembers().length;
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // 단계가 올라가면 잠깐 알려준다 (처음 보여줄 때는 알리지 않음)
  useEffect(() => {
    if (!light.hasRoom) {
      prev.current = null;
      return;
    }
    if (prev.current !== null && light.stage.level > prev.current) {
      setFlash(`방이 ${light.stage.name} 단계가 됐어요!`);
      const t = setTimeout(() => setFlash(null), 6000);
      prev.current = light.stage.level;
      return () => clearTimeout(t);
    }
    prev.current = light.stage.level;
  }, [light.hasRoom, light.stage.level, light.stage.name]);

  if (!light.hasRoom) return null;
  const strict = mode === "programs";
  const next = light.next ? `다음 단계 ${light.next.name}까지 ${hmText(light.minutesToNext ?? 0)}` : "최고 단계예요";

  return (
    <div
      className="clock"
      title={`방 ${light.stage.level}단계 ${light.stage.name} · ${next}\n기록: 방을 만든 뒤 지난 시간 · 작업: ${strict ? "이 방에서 등록한 프로그램으로 작업한 시간" : "'등록한 프로그램만' 모드에서 집계돼요"}`}
    >
      <div className="light">
        <Icon name={light.stage.icon as IconName} size={13} />
        <span>{flash ?? `${light.stage.name} · 방 Lv.${light.stage.level}${people > 1 ? ` · ${people}명` : ""}`}</span>
      </div>
      <span>기록</span>
      <b>{hm(light.minutes)}</b>
      <span className={strict ? "" : "off"}>작업</span>
      <b className={strict ? "" : "off"}>{strict ? hm(workMinutes) : "--:--"}</b>
    </div>
  );
}
