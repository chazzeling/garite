// OS 알림과 "지금 개릿을 보고 있는지" 판정. store 액션만 이 파일을 호출한다.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

/** 개릿의 창(메인·채팅·상점) 중 하나라도 포커스가 있으면 개릿을 보고 있는 것 */
export async function isAppFocused(): Promise<boolean> {
  try {
    if (await getCurrentWindow().isFocused()) return true;
    for (const label of ["chat", "shop"]) {
      if (await (await WebviewWindow.getByLabel(label))?.isFocused()) return true;
    }
  } catch {
    /* 알 수 없으면 아니라고 보고 알림을 보낸다 */
  }
  return false;
}

/** OS 알림 권한 요청 (이미 정해졌으면 아무 일도 없음). 처음 한 번 OS 승인 창이 뜬다 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export async function notifyOs(title: string, body: string) {
  try {
    if (await ensureNotificationPermission()) sendNotification({ title, body });
  } catch {
    /* 알림 실패는 조용히 넘어간다 (앱 안 표시는 따로 있음) */
  }
}
