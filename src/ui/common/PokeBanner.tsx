import { useEffect } from "react";
import { usePoke } from "../../store/poke";
import { Icon } from "./Icon";

// 찌르기를 받았을 때 앱 안에서 보이는 알림 (5초)
export function PokeBanner() {
  const incoming = usePoke((s) => s.incoming);

  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => usePoke.getState().clearIncoming(), 5000);
    return () => clearTimeout(t);
  }, [incoming]);

  if (!incoming) return null;
  return (
    <div className="banner poke" role="status">
      <span><Icon name="bell" size={13} /> {incoming.fromName}님이 찔렀어요. 집중할 시간이에요!</span>
      <button onClick={() => usePoke.getState().clearIncoming()}>확인</button>
    </div>
  );
}
