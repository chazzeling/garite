// 구글 로그인의 앱(Tauri) 쪽: 로컬 콜백을 열고, 시스템 브라우저로 로그인 주소를 열고, 돌아온 쿼리를 받는다.
// Supabase와 직접 통신하는 부분은 net/auth.ts. store 액션만 이 파일을 호출한다.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Supabase 관리 화면의 Redirect URLs에 등록해 둘 주소 (supabase/AUTH_SETUP.md) */
export const OAUTH_REDIRECT = "http://127.0.0.1:41729/callback";

/** getUrl이 준 로그인 주소를 브라우저로 열고, 로그인이 끝나 돌아온 쿼리를 받는다. 시간 초과·취소면 OAUTH_TIMEOUT 오류 */
export async function runOAuth(getUrl: () => Promise<string>): Promise<URLSearchParams> {
  let resolveQuery: (q: string) => void = () => {};
  const result = new Promise<string>((resolve) => (resolveQuery = resolve));
  const unlisten = await listen<string>("oauth-callback", (e) => resolveQuery(e.payload));
  try {
    await invoke("oauth_listen");
    const url = await getUrl();
    await invoke("open_external", { url });
    const query = await result;
    if (!query) throw new Error("OAUTH_TIMEOUT");
    return new URLSearchParams(query);
  } catch (err) {
    await invoke("oauth_cancel").catch(() => {});
    throw err;
  } finally {
    unlisten();
  }
}

export async function cancelOAuth() {
  await invoke("oauth_cancel").catch(() => {});
}
