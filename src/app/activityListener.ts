// Rust가 2초마다 보내는 원시 활동 신호를 상태 판정(store/status)으로 넘긴다.
import { listen } from "@tauri-apps/api/event";
import { useStatus } from "../store/status";
import type { RawActivity } from "../types";

export function startActivityListener() {
  return listen<RawActivity>("activity", (e) => useStatus.getState().ingest(e.payload));
}
