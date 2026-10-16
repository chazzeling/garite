import { create } from "zustand";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { describeError } from "../net/errors";

type UpdateStatus = "idle" | "available" | "downloading" | "error";

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number; // 0~1 (크기를 모르면 0)
  error: string | null;
  /** 새 버전이 있는지 확인 (실패·개발 모드·아직 배포 주소 미설정이면 조용히 넘어감) */
  check: () => Promise<void>;
  /** 사용자가 한 번 확인하면: 내려받고 → 설치하고 → 다시 시작 */
  install: () => Promise<void>;
}

let pending: Update | null = null;

export const useUpdate = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,
  progress: 0,
  error: null,

  check: async () => {
    if (import.meta.env.DEV || get().status === "downloading") return;
    try {
      const update = await check();
      if (update) {
        pending = update;
        set({ status: "available", version: update.version, error: null });
      }
    } catch {
      /* 서버·네트워크 문제로 확인 못 해도 앱 사용에는 영향 없음. 다음 주기에 다시 */
    }
  },

  install: async () => {
    if (!pending) return;
    set({ status: "downloading", progress: 0, error: null });
    let total = 0;
    let done = 0;
    try {
      await pending.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        else if (e.event === "Progress") {
          done += e.data.chunkLength;
          set({ progress: total ? Math.min(1, done / total) : 0 });
        }
      });
      await relaunch(); // Windows는 설치 프로그램이 앱을 다시 띄움
    } catch (err) {
      set({ status: "error", error: describeError(err) });
    }
  },
}));
