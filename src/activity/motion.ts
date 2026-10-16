import cfg from "../config/activity.json";
import type { Motion, RawActivity, WorkState } from "../types";
import type { AppEntry } from "./appWhitelist";

// 우선순위 (5-3). 모든 모션은 최근 motionWithinSeconds(30초) 안에 입력이 있을 때만 — 멈추면 기본 자세.
// 직접 고른 모션은 입력 종류(키보드/마우스)를 가리지 않고, 입력이 있는 동안 그 모션을 계속 재생한다.
// (설명 문구는 ui/room/StatusPanel.tsx의 MOTIONS와 같아야 한다)
//  1) 직접 고른 모션
//  2) 입력 종류를 알 때: keyboard → typing, pointer → 그림 앱이면 drawing, 아니면 none
//  3) 입력 종류를 모를 때: 프로그램 기본 모션
//  4) 프로그램을 모르면 none
// 작업 중이 아닌 상태(쉬는 중·자리 비움)로 표시될 땐 모션을 재생하지 않는다.
export function decideMotion(input: {
  idleSeconds: number;
  inputKind: RawActivity["inputKind"];
  state: WorkState;
  app: AppEntry | null;
  manualMotion: Motion | null;
}): Motion {
  if (input.state !== "working") return "none";
  if (input.idleSeconds >= cfg.motionWithinSeconds) return "none";
  if (input.manualMotion) return input.manualMotion;
  if (input.inputKind === "keyboard") return "typing";
  if (input.inputKind === "pointer") return input.app?.motion === "drawing" ? "drawing" : "none";
  return input.app?.motion ?? "none";
}
