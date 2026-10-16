import type { CSSProperties } from "react";
import type { SpriteImage } from "../../assets/registry";

// 도트 PNG 한 장(또는 가로 프레임 스트립)을 그린다. 프레임이 둘 이상이면 CSS steps()로 재생 (렌더 루프 없음).
// 크기(w, h)는 호출하는 쪽이 정한다 — 방 안에서는 --px(방 그림 1px의 화면 크기)의 배수로.
export function Sprite({ image, w, h, className = "" }: { image: SpriteImage; w: string; h: string; className?: string }) {
  const style: CSSProperties = {
    width: w,
    height: h,
    backgroundImage: `url(${image.url})`,
    backgroundSize: `${image.frames * 100}% 100%`,
    ...(image.frames > 1 ? { animation: `sprite-frames ${image.frames * 250}ms steps(${image.frames}, jump-none) infinite` } : {}),
  };
  return <span className={`pixel ${className}`} style={style} />;
}
