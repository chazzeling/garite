import { create } from "zustand";
import items from "../config/items.json";
import slots from "../config/slots.json";
import { levelOf } from "../activity/level";
import { describeError } from "../net/errors";
import { openUserChannel } from "../net/userChannel";
import { equipItem, fetchEconomy, fetchEquipped, fetchUnlocks, logMinute, unlockItem } from "../net/economyApi";
import { useMe } from "./me";
import cfg from "../config/activity.json";
import { takeWorkSeconds } from "./status";
import { useWorkPrefs } from "./workPrefs";

interface EconomyState {
  earned: number; // 누적 적립 (레벨 기준, 줄지 않음)
  spent: number;
  roomTotal: number; // 지금 방에서 함께 쌓은 합계 (방이 사라지면 0부터)
  /** 방이 만들어진 뒤 경과 초(서버 기준) + 그 값을 받은 시각. 화면은 받은 뒤 흐른 시간을 더해 그린다 */
  roomAge: { seconds: number; at: number } | null;
  roomWorkMinutes: number; // 이 방에서 내가 "등록한 프로그램만" 모드로 쌓은 작업 분
  /** 서버에서 재화 정보를 못 읽었을 때의 사유 (HUD에 ⚠로 표시). 성공하면 null */
  loadError: string | null;
  unlocked: string[];
  equipped: Record<string, string>; // slotId → itemId (내 것)
  sceneEquipped: Record<string, string>; // 지금 보고 있는 방(방장)의 장착 상태
  notice: string | null;
  /** 상점 창에서 바꾼 것(해금·장착·꾸미기)을 메인 창에 알림 */
  announce: () => void;
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
    const { roomAgeSeconds, ...rest } = eco;
    set({ ...rest, loadError: null, roomAge: roomAgeSeconds == null ? null : { seconds: roomAgeSeconds, at: Date.now() }, unlocked, equipped });
  };

  // 지난 1분 중 "작업"으로 인정된 시간이 기준(40초) 이상일 때만 그 분을 기록한다.
  // 무엇을 작업으로 보는지는 store/workPrefs(입력이 있으면 / 등록한 프로그램만)와 activity/workTime이 정한다. 오프라인 시간은 소급하지 않는다.
  const tick = async () => {
    if (takeWorkSeconds() < cfg.workMinuteThresholdSeconds) return;
    try {
      if ((await logMinute(useWorkPrefs.getState().mode === "programs")) > 0) await get().refresh();
    } catch {
      /* 실패한 분은 그냥 건너뛴다 */
    }
  };

  return {
    earned: 0,
    spent: 0,
    roomTotal: 0,
    roomAge: null,
    roomWorkMinutes: 0,
    loadError: null,
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

    announce: () => void shopChannel?.notifyEconomyChanged(),

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
      } catch (err) {
        set({ loadError: describeError(err) }); // 다음 갱신 때 다시 시도. 사유는 HUD의 ⚠에 표시
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
