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
  full: { w: 320, h: 640 },
  // 높이 = 헤더 42 + 위 여백 4 + 방 312 + 아래 여백 10 (방은 최대 창과 동일: 폭 300 × 높이 312)
  medium: { w: 320, h: 368 },
  mini: { w: 320, h: 44 },
};

// resize=false: 앱 시작 시 (window-state가 복원한 크기를 유지)
export async function applyMode(mode: WindowMode, resize: boolean) {
  const win = getCurrentWindow();
  const isMini = mode === "mini";
  await win.setMinSize(null);
  await win.setResizable(!isMini);
  await win.setDecorations(!isMini);
  if (resize) {
    const { w, h } = MODE_SIZE[mode];
    await win.setSize(new LogicalSize(w, h));
  }
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
    width: 360,
    height: 480,
    alwaysOnTop: pinned,
  });
  await chat.once("tauri://destroyed", onClosed);
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
  new WebviewWindow("shop", { url: "shop.html", title: "상점", width: 420, height: 520, minWidth: 340, minHeight: 360, alwaysOnTop: pinned });
}

// 미니 모드 너비는 멤버 수에 따라 가변 (높이 44 고정)
export async function fitMiniWidth(memberCount: number) {
  const width = 190 + Math.max(memberCount, 1) * 130;
  await getCurrentWindow().setSize(new LogicalSize(width, MODE_SIZE.mini.h));
}
