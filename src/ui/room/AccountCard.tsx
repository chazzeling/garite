import { useEffect, useState } from "react";
import { useAccount } from "../../store/account";

// 계정: 임시 계정(이 컴퓨터에만 저장)을 구글에 연결해 두면 다른 컴퓨터에서도 이어서 쓸 수 있다.
export function AccountCard() {
  const { info, busy, message } = useAccount();
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  useEffect(() => {
    void useAccount.getState().refresh();
  }, []);

  if (!info) return null;
  const linked = info.hasGoogle && !info.isAnonymous;

  return (
    <div className="card">
      <div className="card-title">계정</div>
      {busy ? (
        <>
          <p className="hint">브라우저에서 구글 로그인을 마쳐 주세요. 끝나면 이 창으로 돌아와요.</p>
          <button className="ghost" onClick={() => void useAccount.getState().cancel()}>취소</button>
        </>
      ) : linked ? (
        <p className="hint">구글 계정이 연결돼 있어요{info.email ? ` (${info.email})` : ""}. 다른 컴퓨터에서는 처음 화면의 '구글로 로그인'으로 이어서 쓸 수 있어요.</p>
      ) : (
        <>
          <p className="hint">임시 계정이에요. 컴퓨터를 바꾸거나 앱 데이터를 지우면 이름·불씨·꾸미기가 사라져요.</p>
          <button className="primary" onClick={() => void useAccount.getState().link()}>구글 계정 연결하기</button>
          {confirmSwitch ? (
            <div className="confirm">
              <span className="hint">지금 계정의 진행 상황은 사라지고, 연결해 둔 계정으로 바뀌어요.</span>
              <button className="ghost sm" onClick={() => setConfirmSwitch(false)}>취소</button>
              <button className="danger sm" onClick={() => void useAccount.getState().signIn()}>로그인</button>
            </div>
          ) : (
            <button className="ghost danger-text sm" onClick={() => setConfirmSwitch(true)}>이미 연결한 계정으로 로그인</button>
          )}
        </>
      )}
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
