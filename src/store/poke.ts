import { create } from "zustand";
import cfg from "../config/activity.json";
import { isAppFocused, notifyOs } from "../app/notify";
import { describeError } from "../net/errors";
import { pokeMember } from "../net/rpc";
import { useWindowPrefs } from "./windowPrefs";

interface PokeState {
  /** 방금 받은 찌르기 (배너·캐릭터 흔들림용). nonce가 바뀔 때마다 새 찌르기 */
  incoming: { fromName: string; nonce: number } | null;
  /** 내가 찌른 시각 (userId → ms) — 버튼 쿨다운 표시용 */
  sentAt: Record<string, number>;
  notice: string | null;
  receive: (fromName: string) => Promise<void>;
  clearIncoming: () => void;
  poke: (targetUserId: string) => Promise<void>;
}

let nonce = 0;

export const usePoke = create<PokeState>((set, get) => ({
  incoming: null,
  sentAt: {},
  notice: null,

  // 개릿을 보고 있으면 앱 안에서만, 다른 프로그램을 보고 있으면 OS 알림도 보낸다.
  // 미니 모드는 앱 안 표시 공간이 없으므로 항상 OS 알림.
  receive: async (fromName) => {
    set({ incoming: { fromName, nonce: ++nonce } });
    const mini = useWindowPrefs.getState().mode === "mini";
    if (mini || !(await isAppFocused())) {
      await notifyOs("찔렀어요 👈", `${fromName}님이 찔렀어요. 집중할 시간이에요!`);
    }
  },

  clearIncoming: () => set({ incoming: null }),

  poke: async (targetUserId) => {
    const last = get().sentAt[targetUserId];
    if (last && Date.now() - last < cfg.pokeCooldownSeconds * 1000) return;
    set({ notice: null });
    try {
      await pokeMember(targetUserId);
      set((s) => ({ sentAt: { ...s.sentAt, [targetUserId]: Date.now() } }));
    } catch (err) {
      // 서버 쿨다운에 걸렸다면 그 시점부터 다시 센다
      if (String((err as { message?: string })?.message).includes("POKE_COOLDOWN")) {
        set((s) => ({ sentAt: { ...s.sentAt, [targetUserId]: Date.now() } }));
      }
      set({ notice: describeError(err) });
    }
  },
}));
