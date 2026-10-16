import { create } from "zustand";
import cfg from "../config/activity.json";
import { isSelfApp, resolveApp } from "../activity/appWhitelist";
import { classify, NO_MANUAL, shouldEndFocus, type ManualStatus } from "../activity/classify";
import { decideMotion } from "../activity/motion";
import type { MemberStatus, RawActivity } from "../types";

// Presence로 공유되는 내 상태 중 판정으로 정해지는 부분
export type MyStatus = Pick<MemberStatus, "state" | "motion" | "appLabel" | "customText" | "focusMode">;

interface StatusState {
  mine: MyStatus; // 값이 바뀔 때만 새 객체 → room 스토어가 이때만 Presence를 갱신
  manual: ManualStatus;
  shareApp: boolean; // 프로그램 이름을 읽고 친구에게 보여줄지 (동의한 경우만 true. 끄면 Rust도 읽지 않음)
  setShareApp: (on: boolean) => void;
  ingest: (raw: RawActivity) => void; // Rust가 2초마다 보내는 원시 신호
  setManual: (patch: Partial<ManualStatus>) => void;
  toggleFocus: () => void;
}

let lastRaw: RawActivity = { idleSeconds: 0, appId: null };
let focusMode = false;
let shareApp = false; // 동의 전에는 꺼짐 (store/privacy가 켠다)
// 이 앱이 맨 앞일 땐 직전에 쓰던 프로그램 이름을 유지 (핀 고정으로 이 앱을 만지는 동안 라벨이 깜빡이지 않게)
let lastExternalApp: string | null = null;

const initial: MyStatus = {
  state: "working",
  motion: "none",
  appLabel: null,
  customText: null,
  focusMode: false,
};

const keyOf = (s: MyStatus) => JSON.stringify(s);

export const useStatus = create<StatusState>((set, get) => {
  const recompute = (manual: ManualStatus) => {
    const { idleSeconds, inputKind } = lastRaw;
    const app = resolveApp(lastExternalApp);
    const state = classify({ idleSeconds, focusMode, manualState: manual.state });
    const next: MyStatus = {
      state,
      motion: decideMotion({ idleSeconds, inputKind, state, app, manualMotion: manual.motion }),
      appLabel: shareApp ? (app?.label ?? null) : null,
      customText: manual.text,
      focusMode,
    };
    if (keyOf(next) !== keyOf(get().mine)) set({ mine: next });
  };

  return {
    mine: initial,
    manual: NO_MANUAL,
    shareApp: false,

    setShareApp: (on) => {
      shareApp = on;
      if (!on) lastExternalApp = null; // 끄면 이미 읽은 이름도 지운다
      set({ shareApp: on });
      recompute(get().manual);
    },

    ingest: (raw) => {
      lastRaw = raw;
      if (raw.appId && !isSelfApp(raw.appId)) lastExternalApp = raw.appId;
      if (focusMode && shouldEndFocus(raw.idleSeconds)) focusMode = false;
      recompute(get().manual);
    },

    setManual: (patch) => {
      const manual = {
        ...get().manual,
        ...patch,
        text: patch.text === undefined ? get().manual.text : (patch.text?.slice(0, cfg.customTextMax) || null),
      };
      set({ manual });
      recompute(manual);
    },

    toggleFocus: () => {
      focusMode = !focusMode;
      recompute(get().manual);
    },
  };
});
