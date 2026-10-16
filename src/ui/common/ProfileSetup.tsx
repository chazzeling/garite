import { useEffect, useState } from "react";
import { useAccount } from "../../store/account";
import { useMe } from "../../store/me";

// 첫 화면. 두 갈래:
//  ① 구글로 시작하기 — 처음이든 다시 온 사람이든 가능. 이미 연결해 둔 계정이면 이전 모습 그대로 돌아오고,
//     처음이면 구글에 묶인(안전하게 저장되는) 새 계정이 만들어진 뒤 이름만 정하면 된다.
//  ② 구글 없이 시작 — 이름만 정하는 임시 계정. 나중에 내 상태 탭에서 구글을 연결할 수 있다.
export function ProfileSetup() {
  const [name, setName] = useState("");
  const error = useMe((s) => s.error);
  const { info, busy, message } = useAccount();
  const valid = name.trim().length >= 1 && name.trim().length <= 12;
  const withGoogle = !!info?.hasGoogle && !info.isAnonymous; // 구글로 로그인한 뒤 이름만 남은 상태

  useEffect(() => {
    void useAccount.getState().refresh();
  }, []);

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void useMe.getState().createProfile(name);
      }}
    >
      <div className="setup-badge">🏠</div>
      <h3>개릿에 온 걸 환영해요</h3>

      {withGoogle ? (
        <>
          <p className="hint">구글 계정{info?.email ? `(${info.email})` : ""}으로 시작해요.<br />친구들에게 보일 이름을 정해주세요.</p>
          <input value={name} maxLength={12} autoFocus placeholder="1~12자" onChange={(e) => setName(e.target.value)} />
          <button className="primary" disabled={!valid}>시작하기</button>
        </>
      ) : (
        <>
          <button type="button" className="primary" disabled={busy} onClick={() => void useAccount.getState().signIn()}>
            {busy ? "브라우저에서 로그인하세요…" : "구글로 시작하기"}
          </button>
          {busy ? (
            <button type="button" className="ghost sm" onClick={() => void useAccount.getState().cancel()}>취소</button>
          ) : (
            <p className="hint">계정이 안전하게 저장돼요.</p>
          )}
          <div className="or"><span>또는 구글 없이</span></div>
          <input value={name} maxLength={12} placeholder="이름 (1~12자)" onChange={(e) => setName(e.target.value)} />
          <button className="ghost" disabled={!valid || busy}>임시 계정으로 시작하기</button>
          <p className="hint">나중에 내 상태 탭에서 구글 계정을 연결할 수 있어요.</p>
        </>
      )}

      {error && <p className="err">{error}</p>}
      {message && <p className="err">{message}</p>}
    </form>
  );
}
