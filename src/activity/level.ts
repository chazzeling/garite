// 누적 적립 → 레벨 (순수 함수). 서버의 level_for와 같은 규칙.
import levels from "../config/levels.json";

export const MAX_LEVEL = levels[levels.length - 1].level;

export function levelOf(earned: number): number {
  let lv = levels[0].level;
  for (const l of levels) if (earned >= l.requiredTotal) lv = l.level;
  return lv;
}

/** 다음 레벨까지 필요한 누적량 (만렙이면 null) */
export function nextLevelAt(level: number): number | null {
  return levels.find((l) => l.level === level + 1)?.requiredTotal ?? null;
}
