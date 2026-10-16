import { create } from "zustand";
import items from "../config/items.json";
import slots from "../config/slots.json";
import { levelOf } from "../activity/level";
import { describeError } from "../net/errors";
import { openUserChannel } from "../net/userChannel";
import { equipItem, fetchEconomy, fetchEquipped, fetchUnlocks, logMinute, unlockItem } from "../net/economyApi";
import { useMe } from "./me";
import { useStatus } from "./status";

interface EconomyState {
  earned: number; // 누적 적립 (레벨 기준, 줄지 않음)
  spent: number;
  roomTotal: number; // 지금 방에서 함께 쌓은 합계 (방이 사라지면 0부터)
  unlocked: string[];
  equipped: Record<string, string>; // slotId → itemId (내 것)
  sceneEquipped: Record<string, string>; // 지금 보고 있는 방(방장)의 장착 상태
  notice: string | null;
  /** 상점 창 전용: 데이터 로드 + 변경을 메인 창에 알릴 채널 (작업 시간 기록은 하지 않음) */
  startShop: () => Promise<void>;
  /** 메인 창 전용: 데이터 로드 + 1분마다 작업 시간 기록 시작 */
  start: () => Promise<void>;
  refresh: () => Promise<void>;
  loadScene: (ownerId: string | null) => Promise<void>;
  unlock: (itemId: string) => Promise<void>;
  equip: (slotId: string, itemId: string) => Promise<void>;
}

let timer: ReturnType<typeof setInterval> | null = null;
let shopChannel: ReturnType<typeof openUserChannel> | null = null; // 상점 창에서만 연다

export const useEconomy = create<EconomyState>((set, get) => {
  const load = async () => {
    const userId = useMe.getState().userId;
    if (!userId) return;
    const [eco, unlocked, equipped] = await Promise.all([fetchEconomy(), fetchUnlocks(userId), fetchEquipped(userId)]);
    set({ ...eco, unlocked, equipped });
  };

  // working(집중 모드 포함)으로 보일 때만 1분마다 기록. 오프라인 시간은 소급하지 않는다.
  const tick = async () => {
    if (useStatus.getState().mine.state !== "working") return;
    try {
      if ((await logMinute()) > 0) await get().refresh();
    } catch {
      /* 실패한 분은 그냥 건너뛴다 */
    }
  };

  return {
    earned: 0,
    spent: 0,
    roomTotal: 0,
    unlocked: [],
    equipped: {},
    sceneEquipped: {},
    notice: null,

    start: async () => {
      if (useMe.getState().status !== "ready" || timer) return;
      timer = setInterval(() => void tick(), 60_000);
      try {
        await load();
        // 무료(cost 0)·레벨 충족 아이템은 자동 해금
        for (const it of items) {
          if (it.cost === 0 && it.unlockLevel <= levelOf(get().earned) && !get().unlocked.includes(it.id)) {
            await unlockItem(it.id).catch(() => {});
          }
        }
        await load();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    startShop: async () => {
      const userId = useMe.getState().userId;
      if (useMe.getState().status !== "ready" || !userId || shopChannel) return;
      shopChannel = openUserChannel(userId, { onRoomChanged: () => {}, onKicked: () => {} });
      await get().refresh();
      window.addEventListener("focus", () => void get().refresh());
    },

    refresh: async () => {
      try {
        await load();
      } catch {
        /* 다음 갱신 때 다시 */
      }
    },

    // 방은 방장의 꾸밈을 보여준다. 방이 없으면 내 방(내 장착)
    loadScene: async (ownerId) => {
      const userId = useMe.getState().userId;
      const target = ownerId ?? userId;
      if (!target) return;
      try {
        set({ sceneEquipped: await fetchEquipped(target) });
      } catch {
        set({ sceneEquipped: target === userId ? get().equipped : {} });
      }
    },

    unlock: async (itemId) => {
      set({ notice: null });
      try {
        await unlockItem(itemId);
        await load();
        void shopChannel?.notifyEconomyChanged();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    equip: async (slotId, itemId) => {
      const userId = useMe.getState().userId;
      if (!userId || !slots.some((s) => s.id === slotId)) return;
      set({ notice: null });
      try {
        await equipItem(userId, slotId, itemId);
        set({ equipped: { ...get().equipped, [slotId]: itemId } });
        void shopChannel?.notifyEconomyChanged();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },
  };
});
