import cfg from "../config/activity.json";
import type { WorkState } from "../types";

// 직접 고른 상태·모션·문구. null이면 자동.
export type ManualStatus = {
  state: WorkState | null;
  text: string | null;
  motion: "typing" | "drawing" | "none" | null;
};

export const NO_MANUAL: ManualStatus = { state: null, text: null, motion: null };

export function autoState(idleSeconds: number): WorkState {
  if (idleSeconds < cfg.workingBelowSeconds) return "working";
  if (idleSeconds <= cfg.awayAboveSeconds) return "idle";
  return "away";
}

// 집중 모드는 수동으로 끄거나, 입력이 이 시간 넘게 없으면 해제
export const shouldEndFocus = (idleSeconds: number) => idleSeconds > cfg.focusTimeoutSeconds;

// 우선순위: 집중 모드 > 직접 고른 상태 > 자동 판정
export function classify(input: {
  idleSeconds: number;
  focusMode: boolean;
  manualState: WorkState | null;
}): WorkState {
  if (input.focusMode) return "working";
  if (input.manualState) return input.manualState;
  return autoState(input.idleSeconds);
}
