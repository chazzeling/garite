import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAppDetection } from "../app/appDetection";
import { useStatus } from "./status";
import { useWorkPrefs } from "./workPrefs";

// 프로그램 이름 읽기에 대한 동의. null = 아직 묻지 않음(이때는 읽지 않는다).
type Consent = "granted" | "denied" | null;

interface PrivacyState {
  appConsent: Consent;
  /** 친구에게 프로그램 이름을 보여줄지 (동의했을 때만 의미 있음) */
  shareLabel: boolean;
  /** 앱 시작 시: 저장된 동의를 Rust·상태 판정에 적용 (동의 전에는 꺼진 채) */
  init: () => Promise<void>;
  grant: () => Promise<void>;
  deny: () => Promise<void>;
  /** 다시 묻기 (거부했던 사람이 다시 켜려 할 때). 허락할 때까지 꺼진 상태 유지 */
  ask: () => Promise<void>;
  setShareLabel: (on: boolean) => Promise<void>;
  /** 공유를 끈 뒤 다시 켤 때: 공유 의사는 켜 두고 동의 창을 다시 띄운다(허용해야 읽기·공유가 시작) */
  askShare: () => Promise<void>;
}

let modeWatch: (() => void) | null = null;

export const usePrivacy = create<PrivacyState>()(
  persist(
    (set, get) => {
      // 읽기는 동의했고 (친구에게 보여주거나 / 등록 프로그램으로 작업 시간을 세야 할 때) 켠다.
      // 읽은 이름은 공유를 끈 경우 이 컴퓨터에서 작업 시간 판정에만 쓰고 친구에게는 보내지 않는다.
      const sync = async () => {
        const granted = get().appConsent === "granted";
        const detect = granted && (get().shareLabel || useWorkPrefs.getState().mode === "programs");
        useStatus.getState().setShareApp(granted && get().shareLabel);
        await setAppDetection(detect).catch(() => {});
      };
      return {
        appConsent: null,
        shareLabel: true,
        init: async () => {
          modeWatch ??= useWorkPrefs.subscribe((s, prev) => {
            if (s.mode !== prev.mode) void sync();
          });
          await sync();
        },
        grant: async () => {
          set({ appConsent: "granted" });
          await sync();
        },
        deny: async () => {
          set({ appConsent: "denied" });
          await sync();
        },
        ask: async () => {
          set({ appConsent: null });
          await sync();
        },
        setShareLabel: async (on) => {
          set({ shareLabel: on });
          await sync();
        },
        askShare: async () => {
          set({ shareLabel: true, appConsent: null });
          await sync();
        },
      };
    },
    { name: "privacy", partialize: (s) => ({ appConsent: s.appConsent, shareLabel: s.shareLabel }) },
  ),
);
