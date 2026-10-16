import { supabase } from "./supabase";

export type AccountInfo = { isAnonymous: boolean; email: string | null; hasGoogle: boolean };

export async function fetchAccountInfo(): Promise<AccountInfo> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return {
    isAnonymous: !!user?.is_anonymous,
    email: user?.email ?? null,
    hasGoogle: !!user?.identities?.some((i) => i.provider === "google"),
  };
}

/**
 * 구글 로그인 주소.
 *  link   = 지금의 (임시) 계정에 구글을 연결 — 같은 계정이라 이름·불씨·꾸미기가 그대로 남는다
 *  signin = 이미 구글을 연결한 계정으로 로그인 — 새 컴퓨터에서 이어 쓰기(지금 세션은 그 계정으로 바뀜)
 */
export async function googleLoginUrl(mode: "link" | "signin", redirectTo: string): Promise<string> {
  const options = { redirectTo, skipBrowserRedirect: true };
  const res =
    mode === "link"
      ? await supabase.auth.linkIdentity({ provider: "google", options })
      : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (res.error) throw res.error;
  const url = res.data?.url;
  if (!url) throw new Error("로그인 주소를 받지 못했어요.");
  return url;
}

/** 브라우저가 돌려준 쿼리(code 또는 error)로 로그인을 마무리 (PKCE) */
export async function finishGoogleLogin(params: URLSearchParams): Promise<void> {
  const failure = params.get("error_description") ?? params.get("error");
  if (failure) throw new Error(failure);
  const code = params.get("code");
  if (!code) throw new Error("로그인 정보를 받지 못했어요.");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
