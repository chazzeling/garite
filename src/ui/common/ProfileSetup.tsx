import { useState } from "react";
import { useMe } from "../../store/me";

export function ProfileSetup() {
  const [name, setName] = useState("");
  const error = useMe((s) => s.error);
  const valid = name.trim().length >= 1 && name.trim().length <= 12;

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void useMe.getState().createProfile(name);
      }}
    >
      <div className="setup-badge">🏠</div>
      <h3>개릿에 온 걸 환영해요</h3>
      <p className="hint">친구들에게 보일 이름을 정해주세요.</p>
      <input value={name} maxLength={12} autoFocus placeholder="1~12자" onChange={(e) => setName(e.target.value)} />
      <button className="primary" disabled={!valid}>시작하기</button>
      {error && <p className="err">{error}</p>}
    </form>
  );
}
