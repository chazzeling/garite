import { create } from "zustand";
import { cancelOAuth, OAUTH_REDIRECT, runOAuth } from "../app/oauth";
import { describeError } from "../net/errors";
import { fetchAccountInfo, finishGoogleLogin, googleLoginUrl, type AccountInfo } from "../net/auth";
import { useWindowPrefs } from "./windowPrefs";

interface AccountState {
  info: AccountInfo | null;
  busy: boolean;
  message: string | null;
  refresh: () => Promise<void>;
  /** 지금 계정에 구글을 연결 (이름·불씨·꾸미기 그대로) */
  link: () => Promise<void>;
  /** 이미 구글을 연결해 둔 계정으로 로그인. 성공하면 앱을 다시 불러온다 */
  signIn: () => Promise<void>;
  cancel: () => Promise<void>;
}

export const useAccount = create<AccountState>((set, get) => {
  const run = async (mode: "link" | "signin") => {
    set({ busy: true, message: null });
    try {
      await finishGoogleLogin(await runOAuth(() => googleLoginUrl(mode, OAUTH_REDIRECT)));
      return true;
    } catch (err) {
      set({ message: describeError(err) });
      return false;
    } finally {
      set({ busy: false });
    }
  };

  return {
    info: null,
    busy: false,
    message: null,

    refresh: async () => {
      try {
        set({ info: await fetchAccountInfo() });
      } catch {
        /* 서버에 닿지 않으면 다음에 */
      }
    },

    link: async () => {
      if (await run("link")) {
        await get().refresh();
        set({ message: "구글 계정을 연결했어요. 이제 다른 컴퓨터에서도 이어서 쓸 수 있어요." });
      }
    },

    signIn: async () => {
      if (await run("signin")) {
        await useWindowPrefs.getState().closeAuxWindows(); // 채팅·상점 창은 예전 계정 상태이므로 닫는다
        location.reload(); // 새 계정으로 앱을 처음부터 다시 불러온다
      }
    },

    cancel: async () => {
      await cancelOAuth();
    },
  };
});
