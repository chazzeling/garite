// 방 레벨(조명 단계): 촛불 → 전구 → 전등 → 샹들리에 → 별빛.
// 개인 레벨(누적 작업량)과 별개로, 그 방이 만들어진 뒤 지난 "기록 시간"만으로 정해진다 — 방에 모인 사람마다 개인 레벨이 달라도 방은 모두에게 같은 단계다.
// 새 방을 만들면 처음(촛불)부터 다시 시작한다. 단계 기준은 config/roomLevels.json.
import stages from "../config/roomLevels.json";

export type RoomStage = (typeof stages)[number];

export function roomStageOf(minutes: number): { stage: RoomStage; next: RoomStage | null; minutesToNext: number | null } {
  let i = 0;
  for (let k = 0; k < stages.length; k++) if (minutes >= stages[k].minutes) i = k;
  const next = stages[i + 1] ?? null;
  return { stage: stages[i], next, minutesToNext: next ? next.minutes - minutes : null };
}
