// 서버가 던지는 에러 코드(RPC·트리거) → 사용자에게 보여줄 문구
const MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: "그 코드의 방을 찾을 수 없어요.",
  ROOM_CLOSED: "방이 닫혀 있어요.",
  ROOM_FULL: "방이 가득 찼어요. (방장 포함 6명)",
  PROFILE_REQUIRED: "먼저 이름을 정해주세요.",
  NOT_AUTHENTICATED: "로그인이 필요해요.",
  NOT_ROOM_OWNER: "방장만 강퇴할 수 있어요.",
  CANNOT_KICK_SELF: "나 자신은 강퇴할 수 없어요.",
  REASON_INVALID: "사유는 1~30자로 입력해주세요.",
  TARGET_NOT_MEMBER: "이미 방에서 나간 멤버예요.",
  POKE_COOLDOWN: "방금 찔렀어요. 잠시 뒤에 다시 찔러주세요.",
  CANNOT_POKE_SELF: "나 자신은 찌를 수 없어요.",
  NOT_IN_ROOM: "방에 들어가 있어야 찌를 수 있어요.",
  TARGET_NOT_IN_ROOM: "그 사람은 이미 방에 없어요.",
  ITEM_NOT_FOUND: "없는 아이템이에요.",
  ALREADY_UNLOCKED: "이미 해금한 아이템이에요.",
  LEVEL_TOO_LOW: "레벨이 부족해요.",
  NOT_ENOUGH_COINS: "코인이 부족해요.",
};

export function describeError(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? String(err);
  for (const code of Object.keys(MESSAGES)) {
    if (message.includes(code)) return MESSAGES[code];
  }
  if (/fetch|network|failed to/i.test(message)) return "서버에 연결할 수 없어요.";
  return message;
}
