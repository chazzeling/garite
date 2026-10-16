// Tauri 창 조작 모음. store 액션만 이 파일을 호출한다.
import {
  availableMonitors,
  getCurrentWindow,
  LogicalSize,
  primaryMonitor,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { WindowMode } from "../types";

export const MODE_SIZE: Record<WindowMode, { w: number; h: number }> = {
  // 창 전체가 방 틀 하나: 그림 150×156을 ×2 = 300×312 + 테두리 2×2 = 304×316 (컨트롤·버튼은 모두 방 위에 얹힘)
  full: { w: 304, h: 316 },
  // 위 44(얼굴 탭, 투명) + 아래 바 44
  mini: { w: 320, h: 88 },
};

// 창은 항상 테두리 없음·투명·크기 고정(tauri.conf.json). 모드는 크기와 내용만 바꾼다.
// resize=false: 앱 시작 시 (window-state가 복원한 크기를 유지)
export async function applyMode(mode: WindowMode, resize: boolean) {
  const win = getCurrentWindow();
  if (resize) {
    const { w, h } = MODE_SIZE[mode];
    await win.setSize(new LogicalSize(w, h));
  }
}

// 테두리가 없으니 내리기·끄기는 앱 안 버튼이 한다. 끄기는 종료 흐름(방 나가기/닫기)을 거친다.
export async function minimizeApp() {
  await getCurrentWindow().minimize();
}
export async function closeApp() {
  await getCurrentWindow().close();
}

// 핀은 메인 창만이 아니라 이 앱이 여는 보조 창(채팅·상점)에도 같이 적용한다.
const SUB_WINDOWS = ["chat", "shop"];

export async function applyPin(pinned: boolean) {
  await getCurrentWindow().setAlwaysOnTop(pinned);
  for (const label of SUB_WINDOWS) {
    const w = await WebviewWindow.getByLabel(label);
    await w?.setAlwaysOnTop(pinned);
  }
}

// 복원된 위치가 어떤 모니터에도 걸치지 않으면 주 모니터 중앙으로 이동
export async function ensureOnScreen() {
  const win = getCurrentWindow();
  const [pos, size, monitors] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    availableMonitors(),
  ]);
  const cx = pos.x + size.width / 2;
  const cy = pos.y + size.height / 2;
  const visible = monitors.some(
    (m) =>
      cx >= m.position.x &&
      cx < m.position.x + m.size.width &&
      cy >= m.position.y &&
      cy < m.position.y + m.size.height,
  );
  if (visible) return;
  const primary = await primaryMonitor();
  if (!primary) return;
  await win.setPosition(
    new PhysicalPosition(
      Math.round(primary.position.x + (primary.size.width - size.width) / 2),
      Math.round(primary.position.y + (primary.size.height - size.height) / 2),
    ),
  );
}

// 채팅창: 모드와 무관하게 켜고 끔. 닫히면 onClosed 호출(사용자가 X로 닫은 경우 포함).
export async function openChatWindow(onClosed: () => void, pinned: boolean) {
  const existing = await WebviewWindow.getByLabel("chat");
  if (existing) {
    await existing.setAlwaysOnTop(pinned);
    await existing.setFocus();
    return;
  }
  const chat = new WebviewWindow("chat", {
    url: "chat.html",
    title: "채팅",
    width: 304, // 메인 창과 같은 너비
    height: 320, // 예전 480의 2/3
    decorations: false, // 메인 창처럼 제목 줄 없음 — 안의 TitleBar를 잡고 끌어 이동
    alwaysOnTop: pinned,
  });
  await chat.once("tauri://destroyed", onClosed);
}

// 계정을 바꿀 때: 예전 계정 상태를 들고 있는 채팅·상점 창을 닫는다
export async function closeAuxiliaryWindows() {
  for (const label of SUB_WINDOWS) await (await WebviewWindow.getByLabel(label))?.close().catch(() => {});
}

export async function closeChatWindow() {
  const chat = await WebviewWindow.getByLabel("chat");
  await chat?.close();
}

// 상점 창: 모드와 무관한 별도 창. 이미 열려 있으면 앞으로 가져온다.
export async function openShopWindow(pinned: boolean) {
  const existing = await WebviewWindow.getByLabel("shop");
  if (existing) {
    await existing.setAlwaysOnTop(pinned);
    await existing.setFocus();
    return;
  }
  // 채팅 창과 같은 인터페이스: 제목 줄 없음 — 안의 TitleBar를 잡고 끌어 이동
  new WebviewWindow("shop", { url: "shop.html", title: "상점", width: 304, height: 520, minWidth: 304, minHeight: 360, decorations: false, alwaysOnTop: pinned });
}

// 미니 모드 너비는 멤버 수에 따라 가변 (높이 44 고정)
export async function fitMiniWidth(memberCount: number) {
  const width = 210 + Math.max(memberCount, 1) * 130; // 컨트롤 영역 210 + 멤버 칸 130
  await getCurrentWindow().setSize(new LogicalSize(width, MODE_SIZE.mini.h));
}
