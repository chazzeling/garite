import apps from "../config/apps.json";
import type { Motion } from "../types";

export type AppEntry = { label: string; motion: Motion };

// apps.json은 "허용 목록"이 아니라 표시 이름·기본 모션을 덮어쓰는 목록이다.
// 목록에 없는 프로그램도 감지된 이름을 그대로 보여준다 (모션은 입력 종류로만 결정).
const known = apps.map((a) => ({
  names: a.match.map((m) => m.toLowerCase()),
  entry: { label: a.label, motion: a.motion as Motion },
}));

// 이 앱 자신은 프로그램으로 치지 않는다
// 개발 중 이름(darakbang)도 함께 제외
const SELF = ["garite", "garite.exe", "개릿", "darakbang", "darakbang.exe"];
export const isSelfApp = (appId: string | null) => !!appId && SELF.includes(appId.toLowerCase());

const LABEL_MAX = 12;

// "chrome.exe" → "chrome", 너무 길면 줄임
function shorten(appId: string): string {
  const name = appId.replace(/\.exe$/i, "").trim();
  return name.length > LABEL_MAX ? name.slice(0, LABEL_MAX - 1) + "…" : name;
}

export function resolveApp(appId: string | null): AppEntry | null {
  if (!appId || isSelfApp(appId) || /null/i.test(appId)) return null; // lsappinfo가 `[ NULL ]`을 줄 때 방어
  const id = appId.toLowerCase();
  return known.find((t) => t.names.includes(id))?.entry ?? { label: shorten(appId), motion: "none" };
}
