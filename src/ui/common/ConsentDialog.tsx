import { usePrivacy } from "../../store/privacy";

// 프로그램 이름을 읽기 전에 반드시 허락을 받는다. 허락 전에는 읽지 않는다.
export function ConsentDialog() {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="modal">
        <h3 id="consent-title">지금 쓰는 프로그램을 보여줄까요?</h3>
        <ul>
          <li>지금 맨 앞에 있는 <b>프로그램 이름</b>만 읽어요. (예: 크롬, VS Code)</li>
          <li>창 제목, 화면, 입력한 내용은 읽지 않아요.</li>
          <li>친구에게 보여주는 데(같은 방 친구에게만)와, 내가 등록한 프로그램만 작업 시간으로 세는 데 써요.</li>
          <li>언제든 <b>내 상태</b>에서 공유를 끄거나 작업 시간 인정 방식을 바꿀 수 있어요.</li>
        </ul>
        <div className="modal-actions">
          <button className="ghost" onClick={() => void usePrivacy.getState().deny()}>허용 안 함</button>
          <button className="primary" autoFocus onClick={() => void usePrivacy.getState().grant()}>허용</button>
        </div>
      </div>
    </div>
  );
}
