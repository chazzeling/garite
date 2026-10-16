import { useMe } from "../../store/me";
import { useRoom } from "../../store/room";

// 서버에 닿지 않을 때 안내 + 재시도. 내 방은 계속 열려 있다.
export function ServerBanner() {
  const status = useMe((s) => s.status);
  const error = useMe((s) => s.error);
  const connection = useRoom((s) => s.connection);
  const notice = useRoom((s) => s.notice);

  const down = status === "offline" || connection === "error";
  if (!down && !notice) return null;

  return (
    <div className="banner">
      <span>{down ? (error ?? "서버에 연결할 수 없어요") : notice}</span>
      {down && (
        <button
          onClick={async () => {
            await useMe.getState().init();
            await useRoom.getState().start();
          }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
