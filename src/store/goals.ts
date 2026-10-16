import { create } from "zustand";
import goals from "../config/goals.json";
import { kstDay } from "../activity/units";
import { claimGoals, fetchGoals } from "../net/economyApi";

interface GoalsState {
  todayMinutes: number;
  weekMinutes: number;
  claimed: string[];
  /** 한국 시간 기준으로 위 값이 속한 날 (자정이 지나면 서버에서 다시 읽는다) */
  day: string;
  /** 방금 받은 보너스 안내 (배너가 몇 초 보여 주고 지운다) */
  toast: { goalLabel: string; coins: number } | null;
  refresh: () => Promise<void>;
  /** 1분이 기록된 직후 호출: 새 목표에 도달했으면 서버에서 받는다. 보너스를 받았으면 true */
  afterMinute: () => Promise<boolean>;
  clearToast: () => void;
}

export const useGoals = create<GoalsState>((set, get) => ({
  todayMinutes: 0,
  weekMinutes: 0,
  claimed: [],
  day: kstDay(),
  toast: null,

  refresh: async () => {
    try {
      const g = await fetchGoals();
      set({ ...g, day: kstDay() });
    } catch {
      /* 통계는 다음 갱신 때 다시 읽는다 */
    }
  },

  afterMinute: async () => {
    if (get().day !== kstDay()) await get().refresh(); // 자정이 지났으면 새 하루부터
    const today = get().todayMinutes + 1;
    set((s) => ({ todayMinutes: today, weekMinutes: s.weekMinutes + 1 }));
    if (!goals.some((g) => g.minutes <= today && !get().claimed.includes(g.id))) return false;
    try {
      const got = await claimGoals();
      await get().refresh();
      if (got.length === 0) return false;
      const top = goals.filter((g) => got.some((x) => x.goalId === g.id)).pop();
      set({ toast: { goalLabel: top?.label ?? "", coins: got.reduce((a, x) => a + x.coins, 0) } });
      return true;
    } catch {
      return false; // 다음 분에 다시 시도
    }
  },

  clearToast: () => set({ toast: null }),
}));
