import { useEffect, useState } from "react";
import { getAutostart, setAutostart } from "../../app/autostart";
import { usePrivacy } from "../../store/privacy";
import { useWorkPrefs } from "../../store/workPrefs";
import { GoalsCard } from "./GoalsCard";
import { AccountCard } from "./AccountCard";
import { DiagnosticsCard } from "./DiagnosticsCard";
import { useStatus } from "../../store/status";
import type { Motion, WorkState } from "../../types";
import cfg from "../../config/activity.json";

const STATES: { id: WorkState | null; label: string }[] = [
  { id: null, label: "자동" },
  { id: "working", label: "작업 중" },
  { id: "idle", label: "쉬는 중" },
  { id: "away", label: "자리 비움" },
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
  const counting = useStatus((s) => s.counting);
  const consent = usePrivacy((s) => s.appConsent);
  const { mode, programs, recent } = useWorkPrefs();
  // 등록한 프로그램(최근 목록에 없어도 표시) + 최근 감지된 프로그램
  const known = new Map(recent.map((r) => [r.key, r.label]));
  const listed = [...new Set([...programs, ...recent.map((r) => r.key)])];
  const { setManual, toggleFocus } = useStatus.getState();
  const [autostart, setAuto] = useState(false);
  useEffect(() => {
    void getAutostart().then(setAuto);
  }, []);

  return (
    <div className="stack">
      <GoalsCard />
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
        <details className="more">
          <summary>움직임 설정 <span className="hint">(보통은 자동)</span></summary>
          <div className="field">
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
        </details>
      </div>

      <div className="card">
        <div className="card-title">작업 시간 인정</div>
        <div className="chips">
          <button className={mode === "input" ? "on" : ""} onClick={() => useWorkPrefs.getState().setMode("input")}>입력이 있으면</button>
          <button
            className={mode === "programs" ? "on" : ""}
            onClick={() => {
              useWorkPrefs.getState().setMode("programs");
              if (consent !== "granted") void usePrivacy.getState().ask(); // 프로그램을 읽으려면 허락이 필요
            }}
          >
            등록한 프로그램만
          </button>
        </div>
        <p className="hint">
          {mode === "input"
            ? "키보드·마우스 입력이 있으면 작업 시간으로 쌓여요."
            : "아래에 등록한 프로그램이 맨 앞에 있고 입력이 있을 때만 쌓여요."}
        </p>
        {mode === "programs" && (
          <>
            {consent !== "granted" && (
              <p className="err">프로그램 이름을 읽도록 허락해야 작업 시간이 쌓여요. <button className="sm" onClick={() => void usePrivacy.getState().ask()}>허락하기</button></p>
            )}
            <div className="field-label">
              작업 프로그램 {consent === "granted" && counting !== null && <span className="hint">· {counting ? "지금 쌓이는 중" : "지금은 안 쌓여요"}</span>}
            </div>
            <div className="chips">
              {listed.map((key) => (
                <button key={key} className={programs.includes(key) ? "on" : ""} onClick={() => useWorkPrefs.getState().toggleProgram(key)}>
                  {known.get(key) ?? key}
                </button>
              ))}
              {listed.length === 0 && <span className="hint">쓰는 프로그램을 잠깐 쓰고 오면 여기에 나타나요. 눌러서 등록하세요.</span>}
            </div>
          </>
        )}
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
          <input type="checkbox" checked={shareApp} onChange={(e) => void (e.target.checked ? usePrivacy.getState().askShare() : usePrivacy.getState().setShareLabel(false))} />
          <span className="track" />
          <span className="switch-text">
            <b>프로그램 이름 공유</b>
            <small>끄면 친구에게 안 보여요 (작업 시간 인정에는 내 컴퓨터에서만 써요)</small>
          </span>
        </label>
        <label className="switch row">
          <input type="checkbox" checked={autostart} onChange={(e) => void setAutostart(e.target.checked).then(setAuto)} />
          <span className="track" />
          <span className="switch-text">
            <b>로그인할 때 자동 실행</b>
            <small>컴퓨터를 켜면 개릿도 같이 켜져요</small>
          </span>
        </label>
      </div>

      <AccountCard />
      <DiagnosticsCard />
    </div>
  );
}
