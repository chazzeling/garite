// 자리(좌석) 배치 판정 — 순수 함수. 좌석은 방 주인이 장착한 가구에만 생긴다.
import seatCfg from "../../config/seats.json";
import type { Pose, PresenceMember } from "../../types";

export type Seat = { id: string; slotId: string; pose: Pose; x: number; y: number };
export const SEATS = seatCfg.seats as Seat[];
export const STAND_Y = seatCfg.standY;

/** 가구(슬롯)가 놓여 있어서 앉을 수 있는 좌석 */
export const availableSeats = (equipped: Record<string, string>): Seat[] => SEATS.filter((s) => equipped[s.slotId]);

/**
 * userId → 실제로 앉은 좌석 id (못 앉으면 null = 서 있음).
 * 같은 자리를 둘이 골랐거나 가구가 없으면 서 있는다. 동시에 골랐을 땐 먼저 앉은 사람(seatedAt, 같으면 userId)이 이긴다.
 */
export function resolveSeats(members: PresenceMember[], seats: Seat[]): Map<string, string | null> {
  const ids = new Set(seats.map((s) => s.id));
  const result = new Map<string, string | null>();
  const wanting = members
    .filter((m) => m.seat && ids.has(m.seat))
    .sort((a, b) => a.seatedAt - b.seatedAt || (a.userId < b.userId ? -1 : 1));
  const taken = new Set<string>();
  for (const m of members) result.set(m.userId, null);
  for (const m of wanting) {
    if (taken.has(m.seat!)) continue;
    taken.add(m.seat!);
    result.set(m.userId, m.seat);
  }
  return result;
}
