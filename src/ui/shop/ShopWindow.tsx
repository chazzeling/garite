import { useEffect, useState } from "react";
import shops from "../../config/shops.json";
import { levelOf } from "../../activity/level";
import { useEconomy } from "../../store/economy";
import { useMe } from "../../store/me";
import { ProfileSetup } from "../common/ProfileSetup";

// 상점 창: 옷장 · 가구점 · 소품점. 상품 진열은 에셋이 준비된 뒤에 채운다.
export function ShopWindow() {
  const status = useMe((s) => s.status);
  const earned = useEconomy((s) => s.earned);
  const spent = useEconomy((s) => s.spent);
  const [tab, setTab] = useState(shops[0].id);

  useEffect(() => {
    void useMe.getState().init().then(() => useEconomy.getState().startShop());
  }, []);

  if (status === "needsProfile") return <ProfileSetup />;
  if (status !== "ready") {
    return <div className="shop"><p className="hint">{status === "booting" ? "연결 중…" : "서버에 연결할 수 없어요"}</p></div>;
  }

  const current = shops.find((s) => s.id === tab) ?? shops[0];

  return (
    <div className="shop">
      <header className="shop-head">
        <b>상점</b>
        <span className="wallet-top">
          <span className="lv">Lv.{levelOf(earned)}</span>
          <span className="coins"><i className="coin" />{earned - spent}</span>
        </span>
      </header>
      <nav className="tabs">
        {shops.map((s) => (
          <button key={s.id} className={tab === s.id ? "active" : ""} onClick={() => setTab(s.id)}>
            {s.icon} {s.label}
          </button>
        ))}
      </nav>
      <div className="shop-body">
        <div className="empty">
          <div className="empty-icon">{current.icon}</div>
          <b>{current.label}</b>
          <p className="hint">{current.desc} · 상품을 준비하고 있어요.</p>
        </div>
      </div>
    </div>
  );
}
