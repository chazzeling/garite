import levels from "../../config/levels.json";
import { levelOf, MAX_LEVEL, nextLevelAt } from "../../activity/level";
import { UNIT_NAME, formatCoins, formatUnits, toUnits } from "../../activity/units";
import { useEconomy } from "../../store/economy";

// 지붕 위쪽 가운데에 얹히는 HUD: 개인 레벨(숫자·진행도) · 보유한 불씨(숫자만, "1등불 23불씨"는 툴팁에). 방의 조명 단계는 시계 쪽에 따로 있다.
export function Hud() {
  const earned = useEconomy((s) => s.earned);
  const spent = useEconomy((s) => s.spent);
  const loadError = useEconomy((s) => s.loadError);
  const level = levelOf(earned);
  const next = nextLevelAt(level);
  const from = levels.find((l) => l.level === level)?.requiredTotal ?? 0;
  const pct = next ? Math.min(100, Math.round(((earned - from) / (next - from)) * 100)) : 100;

  // 마우스를 올리면 뜨는 작은 설명: 현재 / 다음 레벨 기준(불씨), 남은 양, 보유량
  const have = formatCoins(earned - spent);
  const tip = next
    ? `Lv.${level} · ${toUnits(earned)}/${toUnits(next)}${UNIT_NAME} · ${formatUnits(toUnits(next - earned))} 남음 · 보유 ${have}`
    : `Lv.${level} 최고 레벨 · 누적 ${formatCoins(earned)} · 보유 ${have}`;

  return (
    <div className="hud">
      <div className="chip tip" data-tip={loadError ? `서버 오류: ${loadError}` : tip}>
        <span className="lv">Lv.{level}{level >= MAX_LEVEL ? " MAX" : ""}</span>
        <span className="hud-bar"><i style={{ width: `${pct}%` }} /></span>
        <span>{loadError ? "⚠" : <><i className="ember" />{toUnits(earned - spent)}</>}</span>
      </div>
    </div>
  );
}
