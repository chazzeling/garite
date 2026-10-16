// 작업 시간 인정 판정 (순수 함수). 2초마다 오는 신호 한 번이 "작업"인지 가른다.
// 모드: input = 작업 중으로 보이면(입력이 있으면) 인정(예전 방식), programs = 내가 등록한 프로그램이 맨 앞에 있을 때만 인정.
import { isSelfApp } from "./appWhitelist";
import type { WorkState } from "../types";

export type WorkMode = "input" | "programs";

/** 프로그램 이름을 비교용 키로: 소문자, 확장자(.exe) 제거 ("Google Chrome" → "google chrome", "chrome.exe" → "chrome") */
export const appKey = (appId: string): string => appId.toLowerCase().replace(/\.exe$/, "").trim();

/**
 * true = 작업, false = 아님, null = 판단 보류(개릿 자신이 맨 앞이라 이번 신호는 세지도 끊지도 않음).
 * state는 입력 유무·집중 모드·직접 고른 상태까지 반영된 값이라 "쉬는 중"으로 직접 바꿨다면 어떤 모드든 인정하지 않는다.
 */
export function countsAsWork(i: { state: WorkState; appId: string | null; mode: WorkMode; programs: string[] }): boolean | null {
  if (i.state !== "working") return false;
  if (i.mode === "input") return true;
  if (!i.appId) return false; // 프로그램을 읽지 못함(허용 안 함·감지 실패)
  if (isSelfApp(i.appId)) return null;
  return i.programs.includes(appKey(i.appId));
}
