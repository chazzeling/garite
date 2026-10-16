// 프로그램 이름 읽기 켜기/끄기 (Rust 명령). store 액션만 이 파일을 호출한다.
import { invoke } from "@tauri-apps/api/core";

export async function setAppDetection(enabled: boolean) {
  await invoke("set_app_detection", { enabled });
}
