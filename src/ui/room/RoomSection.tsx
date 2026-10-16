import { useEffect, useState } from "react";
import { Icon } from "../common/Icon";
import { useMe } from "../../store/me";
import { useRoom } from "../../store/room";

// 방 만들기 · 코드 · 입장 설정 · 코드로 입장
export function RoomSection() {
  const { userId, myRoom } = useMe();
  const ownerId = useRoom((s) => s.ownerId);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const away = ownerId !== null && ownerId !== userId; // 남의 방에 있는 중

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!myRoom) setConfirmClose(false);
  }, [myRoom]);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">내 방</div>
        {!myRoom ? (
          <>
            <p className="hint">방을 만들면 친구에게 알려줄 6자리 코드가 생겨요.</p>
            <button className="primary" onClick={() => void useRoom.getState().createRoom()}>방 만들기</button>
          </>
        ) : (
          <>
            <div className="codebox">
              <code>{myRoom.code}</code>
              <button
                className="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(myRoom.code);
                  setCopied(true);
                }}
              >
                <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <label className="switch">
              <input type="checkbox" checked={myRoom.isOpen} onChange={() => void useMe.getState().toggleOpen()} />
              <span className="track" />
              <span>{myRoom.isOpen ? "친구가 입장할 수 있어요" : "입장을 막아 두었어요"}</span>
            </label>
            <div className="row-actions">
              <button className="ghost" onClick={() => void useMe.getState().reissueCode()} title="이전 코드는 즉시 무효가 돼요">
                코드 재발급
              </button>
              {confirmClose ? (
                <span className="confirm">
                  <span className="hint">멤버가 나가고 채팅 기록이 사라져요</span>
                  <button className="ghost" onClick={() => setConfirmClose(false)}>취소</button>
                  <button
                    className="danger"
                    onClick={() => {
                      setConfirmClose(false);
                      void useRoom.getState().closeRoom();
                    }}
                  >
                    닫기
                  </button>
                </span>
              ) : (
                <button className="ghost danger-text" onClick={() => setConfirmClose(true)}>방 닫기</button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">친구 방에 놀러가기</div>
        <form
          className="join"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void useRoom.getState().joinByCode(code);
            setCode("");
          }}
        >
          <input value={code} maxLength={8} placeholder="코드 6자리" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="primary" disabled={!code.trim()}>입장</button>
        </form>
        {away && <button className="ghost" onClick={() => void useRoom.getState().goHome()}><Icon name="door" size={13} /> 내 방으로 돌아가기</button>}
      </div>
    </div>
  );
}
