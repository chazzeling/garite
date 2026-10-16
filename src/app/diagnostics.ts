import { getVersion } from "@tauri-apps/api/app";
import { recentErrors } from "../net/errors";
import { useMe } from "../store/me";
import { usePrivacy } from "../store/privacy";
import { useRoom } from "../store/room";
import { useUpdate } from "../store/update";
import { useWindowPrefs } from "../store/windowPrefs";
import { useWorkPrefs } from "../store/workPrefs";

// 친구가 "안 돼요" 했을 때 원인을 찾기 위한 진단 정보. 이름·이메일·계정 id·채팅 내용·프로그램 이름은 넣지 않는다.
export async function buildDiagnostics(): Promise<string> {
  const version = await getVersion().catch(() => "알 수 없음");
  const me = useMe.getState();
  const room = useRoom.getState();
  const win = useWindowPrefs.getState();
  const lines = [
    `개릿 ${version} · ${navigator.userAgent}`,
    `화면: 모드 ${win.mode}, 채팅창 ${win.chatOpen ? "열림" : "닫힘"}`,
    `계정: ${me.status}${me.error ? ` (${me.error})` : ""}, 내 방 ${me.myRoom ? "있음" : "없음"}`,
    `방: 연결 ${room.connection}, 멤버 ${room.members.length}명, ${room.ownerId === me.userId ? "내 방" : room.ownerId ? "친구 방" : "방 없음"}`,
    `작업 인정: ${useWorkPrefs.getState().mode}, 프로그램 읽기 동의 ${usePrivacy.getState().appConsent ?? "아직 안 물음"}`,
    `업데이트: ${useUpdate.getState().status}`,
    "",
    "최근 오류:",
    ...(recentErrors().length ? recentErrors().map((e) => `- ${e.at} ${e.message}`) : ["- 없음"]),
  ];
  return lines.join("\n");
}
