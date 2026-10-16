import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAppDetection } from "../app/appDetection";
import { useStatus } from "./status";

// 프로그램 이름 읽기·공유에 대한 동의. null = 아직 묻지 않음(이때는 읽지 않는다).
type Consent = "granted" | "denied" | null;

interface PrivacyState {
  appConsent: Consent;
  /** 앱 시작 시: 저장된 동의를 Rust·상태 판정에 적용 (동의 전에는 꺼진 채) */
  init: () => Promise<void>;
  grant: () => Promise<void>;
  deny: () => Promise<void>;
  /** 다시 묻기 (거부했던 사람이 스위치를 켤 때). 허락할 때까지 꺼진 상태 유지 */
  ask: () => Promise<void>;
}

const apply = async (on: boolean) => {
  useStatus.getState().setShareApp(on);
  await setAppDetection(on).catch(() => {});
};

export const usePrivacy = create<PrivacyState>()(
  persist(
    (set, get) => ({
      appConsent: null,
      init: () => apply(get().appConsent === "granted"),
      grant: async () => {
        set({ appConsent: "granted" });
        await apply(true);
      },
      deny: async () => {
        set({ appConsent: "denied" });
        await apply(false);
      },
      ask: async () => {
        set({ appConsent: null });
        await apply(false);
      },
    }),
    { name: "privacy", partialize: (s) => ({ appConsent: s.appConsent }) },
  ),
);
