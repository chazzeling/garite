import { useUpdate } from "../../store/update";

// 새 버전 안내: 버튼 한 번이면 내려받고 설치하고 다시 시작한다.
export function UpdateBanner() {
  const { status, version, progress, error } = useUpdate();
  if (status === "idle") return null;

  return (
    <div className="banner update" role="status">
      {status === "available" && (
        <>
          <span>새 버전 {version}이 나왔어요.</span>
          <button className="primary sm" onClick={() => void useUpdate.getState().install()}>지금 업데이트</button>
        </>
      )}
      {status === "downloading" && <span>업데이트 중… {progress ? `${Math.round(progress * 100)}%` : ""} 끝나면 자동으로 다시 시작해요.</span>}
      {status === "error" && (
        <>
          <span>업데이트에 실패했어요. {error}</span>
          <button className="sm" onClick={() => void useUpdate.getState().install()}>다시 시도</button>
        </>
      )}
    </div>
  );
}
