import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 설정이 없어도 앱은 뜬다 (내 방은 오프라인으로 열림). 호출 전에 isConfigured를 확인한다.
export const isConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost:54321", key ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: false }, // 구글 로그인(PKCE): 돌아온 code를 앱이 직접 교환한다
});

// 저장된 세션이 없으면 익명 로그인. 두 창은 같은 저장소를 공유하므로 같은 계정이 된다.
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("익명 로그인에 실패했어요");
  return anon.user.id;
}
