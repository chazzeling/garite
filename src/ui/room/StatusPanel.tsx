import { usePrivacy } from "../../store/privacy";
import { useStatus } from "../../store/status";
import type { Motion, WorkState } from "../../types";
import cfg from "../../config/activity.json";

const STATES: { id: WorkState | null; label: string }[] = [
  { id: null, label: "자동" },
  { id: "working", label: "🟢 작업 중" },
  { id: "idle", label: "💤 쉬는 중" },
  { id: "away", label: "🌙 자리 비움" },
];

// 모션 설명은 activity/motion.ts의 실제 규칙과 같아야 한다 (규칙을 바꾸면 여기도 고칠 것)
const MOTIONS: { id: Motion | null; label: string; desc: string }[] = [
  { id: null, label: "자동", desc: "키보드를 치면 타자, 그림 프로그램에서 마우스·펜을 움직이면 그림 모션이 나와요." },
  { id: "typing", label: "⌨️ 타자", desc: "키보드든 마우스든 입력이 있는 동안 항상 타자 모션이에요." },
  { id: "drawing", label: "🎨 그림", desc: "키보드든 마우스든 입력이 있는 동안 항상 그림 모션이에요." },
  { id: "none", label: "없음", desc: "입력이 있어도 모션 없이 가만히 있어요." },
];

export function StatusPanel() {
  const manual = useStatus((s) => s.manual);
  const mine = useStatus((s) => s.mine);
  const shareApp = useStatus((s) => s.shareApp);
  const { setManual, toggleFocus } = useStatus.getState();

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">지금 상태</div>
        <div className="chips">
          {STATES.map((s) => (
            <button key={s.label} className={manual.state === s.id ? "on" : ""} onClick={() => setManual({ state: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={manual.text ?? ""}
          maxLength={cfg.customTextMax}
          placeholder="지금 하는 일 (비우면 프로그램 이름)"
          onChange={(e) => setManual({ text: e.target.value })}
        />
        <div className="field">
          <span className="field-label">움직임 (캐릭터 모션)</span>
          <div className="chips">
            {MOTIONS.map((m) => (
              <button key={m.label} className={manual.motion === m.id ? "on" : ""} onClick={() => setManual({ motion: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="hint">{MOTIONS.find((m) => m.id === manual.motion)?.desc}</p>
          <p className="hint">공통: 입력이 {cfg.motionWithinSeconds}초 이상 없거나 쉬는 중·자리 비움이면 가만히 있어요.</p>
        </div>
      </div>

      <div className="card">
        <label className="switch row">
          <input type="checkbox" checked={mine.focusMode} onChange={toggleFocus} />
          <span className="track" />
          <span className="switch-text">
            <b>집중 모드</b>
            <small>입력이 없어도 작업 중으로 보여요 (30분 뒤 자동 해제)</small>
          </span>
        </label>
        <label className="switch row" title="끄면 친구에게 프로그램 이름이 보이지 않아요">
          <input type="checkbox" checked={shareApp} onChange={(e) => void (e.target.checked ? usePrivacy.getState().ask() : usePrivacy.getState().deny())} />
          <span className="track" />
          <span className="switch-text">
            <b>프로그램 이름 공유</b>
            <small>친구에게 지금 쓰는 프로그램이 보여요</small>
          </span>
        </label>
      </div>
    </div>
  );
}
