import { useRoom } from "../../store/room";

// 강퇴/방 닫힘 안내 (메인 창). 채팅 창은 함께 닫힌다.
export function KickedBanner() {
  const kicked = useRoom((s) => s.kicked);
  if (!kicked) return null;
  return (
    <div className="banner">
      <span>{kicked.text}</span>
      <button onClick={() => useRoom.getState().dismissKick()}>확인</button>
    </div>
  );
}
