import { useEffect } from "react";
import { useGoals } from "../../store/goals";
import { useMe } from "../../store/me";
import { usePoke } from "../../store/poke";
import { useRoom } from "../../store/room";
import { useUpdate } from "../../store/update";

// 미니 모드는 배너를 놓을 자리가 없어서, 얼굴 줄 오른쪽 빈 곳에 알림을 한 번에 하나만 띄운다.
// 우선순위: 업데이트 > 강퇴/방 닫힘 > 찌르기 > 목표 달성 > 서버 연결 문제
export function MiniAlert() {
  const update = useUpdate();
  const kicked = useRoom((s) => s.kicked);
  const poke = usePoke((s) => s.incoming);
  const goal = useGoals((s) => s.toast);
  const status = useMe((s) => s.status);
  const connection = useRoom((s) => s.connection);

  // 찌르기·목표는 몇 초 뒤 저절로 사라진다 (큰 화면의 배너와 같은 길이)
  useEffect(() => {
    if (!poke) return;
    const t = setTimeout(() => usePoke.getState().clearIncoming(), 5000);
    return () => clearTimeout(t);
  }, [poke]);
  useEffect(() => {
    if (!goal) return;
    const t = setTimeout(() => useGoals.getState().clearToast(), 6000);
    return () => clearTimeout(t);
  }, [goal]);

  let text: string | null = null;
  let action: { label: string; run: () => void } | null = null;
  let tone = "";

  if (update.status === "available") {
    text = `새 버전 ${update.version}`;
    action = { label: "업데이트", run: () => void useUpdate.getState().install() };
    tone = "update";
  } else if (update.status === "downloading") {
    text = `업데이트 중… ${update.progress ? `${Math.round(update.progress * 100)}%` : ""}`;
    tone = "update";
  } else if (update.status === "error") {
    text = "업데이트 실패";
    action = { label: "다시", run: () => void useUpdate.getState().install() };
  } else if (kicked) {
    text = kicked.text;
    action = { label: "확인", run: () => useRoom.getState().dismissKick() };
  } else if (poke) {
    text = `${poke.fromName}님이 찔렀어요!`;
    action = { label: "확인", run: () => usePoke.getState().clearIncoming() };
    tone = "update";
  } else if (goal) {
    text = `${goal.goalLabel} 작업 달성!`;
    action = { label: "확인", run: () => useGoals.getState().clearToast() };
    tone = "update";
  } else if (status === "offline" || connection === "error") {
    text = "서버에 연결할 수 없어요";
    action = {
      label: "재시도",
      run: () => void useMe.getState().init().then(() => useRoom.getState().start()),
    };
  }

  if (!text) return null;
  return (
    <div className={`mini-alert ${tone}`} role="status">
      <span title={text}>{text}</span>
      {action && <button className="sm" onClick={action.run}>{action.label}</button>}
    </div>
  );
}
