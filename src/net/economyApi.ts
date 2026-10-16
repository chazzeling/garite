import { supabase } from "./supabase";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

export type EconomyRow = {
  earned: number;
  spent: number;
  roomTotal: number;
  /** 지금 방이 만들어진 뒤 경과 초 (서버 시각 기준, 방이 없으면 null) */
  roomAgeSeconds: number | null;
  /** 이 방에서 내가 "등록한 프로그램만" 모드로 기록한 분 수 */
  roomWorkMinutes: number;
};

/** 1분 작업 기록. 서버가 분·방·적립량을 정한다. 이번에 적립된 코인(중복이면 0) */
export async function logMinute(strict: boolean): Promise<number> {
  return check(await supabase.rpc("log_minute", { p_strict: strict }));
}

export async function fetchEconomy(): Promise<EconomyRow> {
  const rows = check(await supabase.rpc("get_economy"));
  const r = (rows as { earned: number; spent: number; room_total: number; room_age_seconds: number | null; room_work_minutes: number }[])[0];
  return {
    earned: Number(r?.earned ?? 0),
    spent: Number(r?.spent ?? 0),
    roomTotal: Number(r?.room_total ?? 0),
    roomAgeSeconds: r?.room_age_seconds == null ? null : Number(r.room_age_seconds),
    roomWorkMinutes: Number(r?.room_work_minutes ?? 0),
  };
}

/** 레벨·잔액은 서버가 검증하고, 해금하면 해당 카테고리 슬롯에 자동 장착한다 */
export async function unlockItem(itemId: string): Promise<void> {
  check(await supabase.rpc("unlock_item", { p_item: itemId }));
}

export async function fetchUnlocks(userId: string): Promise<string[]> {
  const rows = check(await supabase.from("unlocks").select("item_id").eq("user_id", userId));
  return (rows ?? []).map((r) => r.item_id);
}

/** slotId → itemId */
export async function fetchEquipped(userId: string): Promise<Record<string, string>> {
  const rows = check(await supabase.from("equipped").select("slot_id, item_id").eq("user_id", userId));
  return Object.fromEntries((rows ?? []).map((r) => [r.slot_id, r.item_id]));
}

/** 해금한 아이템으로 슬롯 교체 (서버 RLS가 해금·카테고리 확인) */
export async function equipItem(userId: string, slotId: string, itemId: string): Promise<void> {
  check(await supabase.from("equipped").upsert({ user_id: userId, slot_id: slotId, item_id: itemId }));
}

export type GoalsRow = { todayMinutes: number; weekMinutes: number; claimed: string[] };

/** 오늘·이번 주(월요일 시작, 한국 시간) 작업 분 + 오늘 받은 목표 */
export async function fetchGoals(): Promise<GoalsRow> {
  const rows = check(await supabase.rpc("get_goals")) as { today_minutes: number; week_minutes: number; claimed: string[] | null }[];
  const r = rows[0];
  return { todayMinutes: Number(r?.today_minutes ?? 0), weekMinutes: Number(r?.week_minutes ?? 0), claimed: r?.claimed ?? [] };
}

/** 달성했지만 아직 안 받은 목표를 받는다. 새로 받은 것만 돌려준다 */
export async function claimGoals(): Promise<{ goalId: string; coins: number }[]> {
  const rows = check(await supabase.rpc("claim_goals")) as { goal_id: string; coins: number }[];
  return (rows ?? []).map((r) => ({ goalId: r.goal_id, coins: Number(r.coins) }));
}
