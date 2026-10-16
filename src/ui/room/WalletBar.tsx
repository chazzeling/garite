import { levelOf, MAX_LEVEL, nextLevelAt } from "../../activity/level";
import { Icon } from "../common/Icon";
import { useEconomy } from "../../store/economy";
import { useWindowPrefs } from "../../store/windowPrefs";
import levels from "../../config/levels.json";

// 레벨 · 진행도 · 잔액, 그리고 상점 창을 여는 버튼
export function WalletBar() {
  const earned = useEconomy((s) => s.earned);
  const spent = useEconomy((s) => s.spent);
  const level = levelOf(earned);
  const next = nextLevelAt(level);
  const from = levels.find((l) => l.level === level)?.requiredTotal ?? 0;
  const pct = next ? Math.min(100, Math.round(((earned - from) / (next - from)) * 100)) : 100;

  return (
    <div className="wallet">
      <div className="wallet-top">
        <span className="lv">Lv.{level}{level >= MAX_LEVEL ? " MAX" : ""}</span>
        <span className="coins" title={`누적 ${earned}`}><i className="coin" />{earned - spent}</span>
        <button className="primary sm" onClick={() => void useWindowPrefs.getState().openShop()}><Icon name="bag" size={13} /> 상점</button>
      </div>
      <div className="bar" title={next ? `다음 레벨까지 ${next - earned}` : "최고 레벨"}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <small className="hint">{next ? `다음 레벨까지 ${next - earned}` : "최고 레벨이에요"}</small>
    </div>
  );
}
