export type WindowMode = "full" | "medium" | "mini";

export type WorkState = "working" | "idle" | "away";
export type Pose = "stand" | "sit" | "lie";
export type Motion = "typing" | "drawing" | "none";

// Rust → TS 원시 신호 (Tauri event "activity")
export type RawActivity = {
  idleSeconds: number;
  appId: string | null;
  inputKind?: "keyboard" | "pointer" | null;
};

// Presence로 공유되는 내 상태
export type MemberStatus = {
  userId: string;
  name: string;
  avatarId: string;
  state: WorkState;
  motion: Motion;
  appLabel: string | null;
  customText: string | null;
  focusMode: boolean;
};

export type Profile = { id: string; name: string; avatarId: string };
export type RoomInfo = { code: string; isOpen: boolean };

// Presence payload = MemberStatus + 접속 식별 정보 (같은 계정 중복 접속 판별용)
// seat: 앉으려는 좌석 id (null = 서 있음), seatedAt: 앉은 시각 — 같은 자리를 동시에 골랐을 때 먼저 앉은 사람이 이긴다
export type PresenceMember = MemberStatus & {
  sessionId: string;
  connectedAt: number;
  seat: string | null;
  seatedAt: number;
};

export type ChatMessage = {
  id: number;
  roomOwnerId: string;
  userId: string | null;
  kind: "chat" | "system";
  body: string;
  createdAt: string;
  pending?: boolean; // 서버 저장 전 내 메시지(낙관적 표시)
};
