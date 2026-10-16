import goals from "../../config/goals.json";
import { useGoals } from "../../store/goals";
import { formatCoins, formatMinutes } from "../../activity/units";

// 오늘·이번 주 작업 시간과 오늘의 목표 (목표는 한국 시간 자정에 새로 시작)
export function GoalsCard() {
  const { todayMinutes, weekMinutes, claimed } = useGoals();
  const next = goals.find((g) => !claimed.includes(g.id) && g.minutes > todayMinutes);

  return (
    <div className="card">
      <div className="card-title">오늘의 작업</div>
      <div className="stat-row">
        <span><b>{formatMinutes(todayMinutes)}</b> <small>오늘</small></span>
        <span><b>{formatMinutes(weekMinutes)}</b> <small>이번 주</small></span>
      </div>
      <div className="goal-list">
        {goals.map((g) => {
          const done = claimed.includes(g.id) || todayMinutes >= g.minutes;
          return (
            <div key={g.id} className={`goal ${done ? "done" : ""}`}>
              <span>{done ? "✓" : "○"} {g.label}</span>
              <small>+{formatCoins(g.coins)}</small>
            </div>
          );
        })}
      </div>
      <p className="hint">
        {next ? `${next.label}까지 ${formatMinutes(next.minutes - todayMinutes)} 남았어요.` : "오늘 목표를 모두 채웠어요!"}
      </p>
    </div>
  );
}
