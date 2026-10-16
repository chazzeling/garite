import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

// 컴퓨터를 켜고 로그인할 때 개릿을 자동으로 실행할지. 설정은 OS가 보관한다(앱이 따로 저장하지 않음).
export async function getAutostart(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch {
    return false; // 브라우저 미리보기 등 Tauri 밖
  }
}

export async function setAutostart(on: boolean): Promise<boolean> {
  try {
    if (on) await enable();
    else await disable();
  } catch {
    /* 아래에서 실제 상태를 다시 읽어 화면에 맞춘다 */
  }
  return getAutostart();
}
