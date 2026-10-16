import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WindowMode } from "../types";
import {
  applyMode,
  applyPin,
  fitMiniWidth,
  closeChatWindow,
  ensureOnScreen,
  openChatWindow,
  openShopWindow,
} from "../app/windowMode";

type PinByMode = Partial<Record<WindowMode, boolean>>;

interface WindowPrefsState {
  mode: WindowMode;
  pinByMode: PinByMode; // 모드별로 마지막에 고른 값. 없으면 기본값
  chatOpen: boolean;
  init: () => Promise<void>;
  setMode: (mode: WindowMode) => Promise<void>;
  togglePin: () => Promise<void>;
  toggleChat: () => Promise<void>;
  openShop: () => Promise<void>;
  fitMini: (memberCount: number) => Promise<void>;
}

// 미니 모드 첫 진입 시에만 기본 ON
const defaultPin = (mode: WindowMode) => mode === "mini";
export const selectPinned = (s: Pick<WindowPrefsState, "mode" | "pinByMode">) =>
  s.pinByMode[s.mode] ?? defaultPin(s.mode);

export const useWindowPrefs = create<WindowPrefsState>()(
  persist(
    (set, get) => {
      const openChat = () =>
        openChatWindow(() => set({ chatOpen: false }), selectPinned(get())).catch(() => set({ chatOpen: false }));

      return {
        mode: "full",
        pinByMode: {},
        chatOpen: false,

        // 시작 시: 위치 보정 → 저장된 모드/핀 적용(크기는 window-state가 복원) → 채팅창 복원
        init: async () => {
          await ensureOnScreen();
          await applyMode(get().mode, false);
          await applyPin(selectPinned(get()));
          if (get().chatOpen) await openChat();
        },

        setMode: async (mode) => {
          set({ mode });
          await applyMode(mode, true);
          await applyPin(selectPinned(get()));
        },

        togglePin: async () => {
          const { mode, pinByMode } = get();
          const next = !selectPinned({ mode, pinByMode });
          set({ pinByMode: { ...pinByMode, [mode]: next } });
          await applyPin(next);
        },

        fitMini: async (memberCount) => {
          if (get().mode === "mini") await fitMiniWidth(memberCount);
        },

        openShop: () => openShopWindow(selectPinned(get())).catch(() => {}),

        toggleChat: async () => {
          if (get().chatOpen) {
            set({ chatOpen: false });
            await closeChatWindow();
          } else {
            set({ chatOpen: true });
            await openChat();
          }
        },
      };
    },
    {
      name: "windowPrefs",
      partialize: (s) => ({ mode: s.mode, pinByMode: s.pinByMode, chatOpen: s.chatOpen }),
    },
  ),
);
