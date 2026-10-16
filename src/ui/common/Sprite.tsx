import type { CSSProperties } from "react";
import type { SpriteImage } from "../../assets/registry";

// 도트 PNG 한 장(또는 가로 프레임 스트립)을 그린다. 프레임이 둘 이상이면 CSS steps()로 재생 (렌더 루프 없음).
// 크기(w, h)는 호출하는 쪽이 정한다 — 방 안에서는 --px(방 그림 1px의 화면 크기)의 배수로.
// tint가 있으면 (회색조 그림 × 색)으로 색을 입힌다: 그림의 투명한 부분 밖으로는 번지지 않는다.
export function Sprite({ image, w, h, className = "", tint }: { image: SpriteImage; w: string; h: string; className?: string; tint?: string | null }) {
  const style = {
    width: w,
    height: h,
    backgroundImage: `url(${image.url})`,
    backgroundSize: `${image.frames * 100}% 100%`,
    "--img": `url(${image.url})`,
    "--msize": `${image.frames * 100}% 100%`,
    "--tint": tint ?? "transparent",
    "--frames": image.frames,
    "--dur": `${image.frames * 250}ms`,
  } as CSSProperties;
  const cls = ["pixel", tint ? "tinted" : "", image.frames > 1 ? "anim" : "", className].filter(Boolean).join(" ");
  return <span className={cls} style={style} />;
}
