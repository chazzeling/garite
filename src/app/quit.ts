// 앱 종료 흐름. Rust가 종료 요청(창 닫기·Cmd+Q)을 가로채 "quit-requested"를 보내면,
// 정리(방 나가기/닫기)를 마친 뒤 quit_app으로 종료한다. 정리가 막혀도 Rust가 2.5초 뒤 종료한다.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function listenQuit(cleanup: () => Promise<void>) {
  return listen("quit-requested", async () => {
    await cleanup();
    await invoke("quit_app");
  });
}
