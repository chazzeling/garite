import { useState } from "react";
import items from "../../config/items.json";
import { levelOf } from "../../activity/level";
import { formatCoins } from "../../activity/units";
import { decodeAvatar, HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES } from "../../assets/avatar";
import { useEconomy } from "../../store/economy";
import { useMe } from "../../store/me";
import type { AvatarSpec } from "../../types";
import { AvatarSprite } from "../common/AvatarSprite";

type Category = "hair" | "outfit" | "accessory";

// 옷장: 내 캐릭터 미리보기 + 피부색·머리·머리색·옷·옷색·악세서리 고르기. 가격이 있는 아이템은 등불(불씨·등불)로 해금.
export function AvatarEditor() {
  const profile = useMe((s) => s.profile);
  const { earned, spent, unlocked } = useEconomy();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!profile) return null;

  const spec = decodeAvatar(profile.avatarId);
  const level = levelOf(earned);
  const balance = earned - spent;

  const apply = async (next: AvatarSpec) => {
    setMessage(null);
    const err = await useMe.getState().setAvatar(next);
    if (err) setMessage(err);
    else useEconomy.getState().announce();
  };

  const owned = (id: string, cost: number) => cost === 0 || unlocked.includes(id);

  const buyAndWear = async (id: string, category: Category) => {
    setConfirming(null);
    setMessage(null);
    await useEconomy.getState().unlock(id);
    if (!useEconomy.getState().unlocked.includes(id)) {
      setMessage(useEconomy.getState().notice ?? "구매하지 못했어요.");
      return;
    }
    await apply({ ...spec, [category]: id });
  };

  const options = (category: Category) => {
    const list = items.filter((i) => i.category === category);
    return (
      <div className="chips">
        {category === "accessory" && (
          <button className={spec.accessory === "none" ? "on" : ""} onClick={() => void apply({ ...spec, accessory: "none" })}>없음</button>
        )}
        {list.map((it) => {
          const have = owned(it.id, it.cost);
          const current = spec[category] === it.id;
          const lockedByLevel = !have && level < it.unlockLevel;
          return (
            <button
              key={it.id}
              className={current ? "on" : ""}
              disabled={lockedByLevel}
              title={lockedByLevel ? `Lv.${it.unlockLevel}에 열려요` : undefined}
              onClick={() => (have ? void apply({ ...spec, [category]: it.id }) : setConfirming(confirming === it.id ? null : it.id))}
            >
              {it.name}
              {!have && (lockedByLevel ? <small> Lv.{it.unlockLevel}</small> : <small> <i className="ember" />{formatCoins(it.cost)}</small>)}
            </button>
          );
        })}
      </div>
    );
  };

  const confirmItem = items.find((i) => i.id === confirming);

  const swatches = (colors: string[], selected: number, set: (n: number) => void) => (
    <div className="swatches">
      {colors.map((c, i) => (
        <button key={c} className={`swatch ${i === selected ? "on" : ""}`} style={{ background: c }} aria-label={`색 ${i + 1}`} onClick={() => set(i)} />
      ))}
    </div>
  );

  return (
    <div className="editor">
      <div className="preview">
        <div className="preview-art">
          <AvatarSprite avatarId={profile.avatarId} state="working" motion="none" pose="stand" size="64px" />
        </div>
        <div className="preview-info">
          <b>{profile.name}</b>
          <span className="hint">보유 <i className="ember" />{formatCoins(balance)}</span>
        </div>
      </div>

      {message && <p className="err">{message}</p>}
      {confirmItem && (
        <div className="banner" role="alert">
          <span>{confirmItem.name}을(를) {formatCoins(confirmItem.cost)}에 살까요?</span>
          <span className="confirm">
            <button className="sm" onClick={() => setConfirming(null)}>취소</button>
            <button className="primary sm" disabled={balance < confirmItem.cost} onClick={() => void buyAndWear(confirmItem.id, confirmItem.category as Category)}>
              {balance < confirmItem.cost ? "불씨 부족" : "구매"}
            </button>
          </span>
        </div>
      )}

      <div className="field"><span className="field-label">피부색</span>{swatches(SKIN_TONES, spec.skin, (skin) => void apply({ ...spec, skin }))}</div>
      <div className="field"><span className="field-label">머리 모양</span>{options("hair")}</div>
      <div className="field"><span className="field-label">머리 색</span>{swatches(HAIR_COLORS, spec.hairColor, (hairColor) => void apply({ ...spec, hairColor }))}</div>
      <div className="field"><span className="field-label">옷</span>{options("outfit")}</div>
      <div className="field"><span className="field-label">옷 색</span>{swatches(OUTFIT_COLORS, spec.outfitColor, (outfitColor) => void apply({ ...spec, outfitColor }))}</div>
      <div className="field"><span className="field-label">악세서리</span>{options("accessory")}</div>
    </div>
  );
}
