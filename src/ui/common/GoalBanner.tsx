import { useEffect } from "react";
import { useGoals } from "../../store/goals";
import { formatCoins } from "../../activity/units";
import { Icon } from "./Icon";

// 오늘의 작업 목표를 채웠을 때 보너스 안내 (6초)
export function GoalBanner() {
  const toast = useGoals((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useGoals.getState().clearToast(), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="banner poke" role="status">
      <span><Icon name="target" size={13} /> 오늘 {toast.goalLabel} 작업 달성! 보너스 {formatCoins(toast.coins)}</span>
      <button onClick={() => useGoals.getState().clearToast()}>확인</button>
    </div>
  );
}
