import { useState } from "react";
import { buildDiagnostics } from "../../app/diagnostics";

// 문제가 생겼을 때 개발자(친구)에게 보낼 진단 정보를 클립보드에 복사한다.
export function DiagnosticsCard() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div className="card-title">문제가 생겼나요?</div>
      <p className="hint">앱 버전·연결 상태·최근 오류를 복사해요. 이름·채팅·프로그램 이름은 들어가지 않아요.</p>
      <button
        className="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(await buildDiagnostics());
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "복사됨 — 붙여넣어 보내주세요" : "진단 정보 복사"}
      </button>
    </div>
  );
}
