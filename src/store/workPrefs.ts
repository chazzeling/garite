import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appKey, type WorkMode } from "../activity/workTime";
import { resolveApp } from "../activity/appWhitelist";

export type RecentApp = { key: string; label: string };

interface WorkPrefsState {
  mode: WorkMode;
  /** 작업으로 인정하는 프로그램(appKey). 처음엔 비어 있고 사용자가 직접 등록 */
  programs: string[];
  /** 최근 감지된 프로그램 (등록 목록에 보여줄 후보, 최대 30개). 이 컴퓨터에만 저장 */
  recent: RecentApp[];
  setMode: (mode: WorkMode) => void;
  toggleProgram: (key: string) => void;
  see: (appId: string) => void;
}

export const useWorkPrefs = create<WorkPrefsState>()(
  persist(
    (set, get) => ({
      mode: "input",
      programs: [],
      recent: [],
      setMode: (mode) => set({ mode }),
      toggleProgram: (key) =>
        set((s) => ({ programs: s.programs.includes(key) ? s.programs.filter((k) => k !== key) : [...s.programs, key] })),
      see: (appId) => {
        const key = appKey(appId);
        if (get().recent.some((r) => r.key === key)) return; // 2초마다 불리므로 새 프로그램일 때만 갱신
        set((s) => ({ recent: [{ key, label: resolveApp(appId)?.label ?? key }, ...s.recent].slice(0, 30) }));
      },
    }),
    { name: "workPrefs" },
  ),
);
