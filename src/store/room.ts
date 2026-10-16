import { create } from "zustand";
import type { PresenceMember } from "../types";
import { describeError } from "../net/errors";
import { closeRoom, createRoom, getMyRoom, heartbeat, joinRoom, kickMember, leaveRoom } from "../net/rpc";
import { connectRoom, type RoomConnection } from "../net/roomChannel";
import { openUserChannel, type KickEvent } from "../net/userChannel";
import { useChat } from "./chat";
import { useEconomy } from "./economy";
import { usePoke } from "./poke";
import { useMe } from "./me";
import cfg from "../config/activity.json";
import { useStatus, type MyStatus } from "./status";
import { useWindowPrefs } from "./windowPrefs";

type Connection = "idle" | "connecting" | "connected" | "error";

interface RoomState {
  ownerId: string | null; // 지금 보고 있는 방 (내 방이면 내 id, 방이 없으면 null)
  members: PresenceMember[];
  connection: Connection;
  notice: string | null;
  /** 내가 앉으려는 좌석 id (null = 서 있음). 내 방이면 기본으로 침대 */
  seat: string | null;
  seatedAt: number;
  setSeat: (seat: string | null) => void;
  /** 강퇴당했거나 방이 닫혔다는 안내 문구 (메인 창 배너) */
  kicked: { text: string } | null;
  dismissKick: () => void;
  // 메인 창
  start: () => Promise<void>;
  joinByCode: (code: string) => Promise<void>;
  goHome: () => Promise<void>;
  createRoom: () => Promise<void>;
  closeRoom: () => Promise<void>;
  /** 방장 전용. 권한 검증은 서버(RPC)가 한다 */
  kick: (targetUserId: string, reason: string) => Promise<void>;
  // 채팅 창: 메인 창이 어느 방에 있는지 서버에서 읽어 따라간다
  startChatFollower: () => Promise<void>;
  /** 앱 종료 직전 정리: 남의 방에서 나가고, 내 방이 있으면 닫는다 (최대 1.5초) */
  shutdown: () => Promise<void>;
}

const DEFAULT_SEAT = "bed-1";
const sessionId = crypto.randomUUID();
let conn: RoomConnection | null = null;
let userChannel: ReturnType<typeof openUserChannel> | null = null;

const connectedAt = Date.now();
let statusWatch: (() => void) | null = null;
let isChatWindow = false;

// Presence 전송 제한: 모션만 바뀐 경우는 마지막 전송 후 최소 N초 간격으로,
// 상태·프로그램 이름·문구·집중 모드가 바뀌면 즉시 보낸다.
let sent: { mine: MyStatus; at: number } | null = null;
let motionTimer: ReturnType<typeof setTimeout> | null = null;

const sendPresence = () => {
  const me = presenceOf();
  if (!me) return;
  conn?.update(me);
  sent = { mine: useStatus.getState().mine, at: Date.now() };
};

const clearMotionTimer = () => {
  if (motionTimer) clearTimeout(motionTimer);
  motionTimer = null;
};

const onMineChanged = (mine: MyStatus) => {
  const last = sent;
  const urgent =
    !last ||
    mine.state !== last.mine.state ||
    mine.appLabel !== last.mine.appLabel ||
    mine.customText !== last.mine.customText ||
    mine.focusMode !== last.mine.focusMode;
  if (!last || urgent) {
    clearMotionTimer();
    sendPresence();
    return;
  }
  if (mine.motion === last.mine.motion) {
    clearMotionTimer(); // 원래대로 돌아왔으면 보낼 것이 없다
    return;
  }
  const wait = last.at + cfg.presenceMinIntervalSeconds * 1000 - Date.now();
  if (wait <= 0) sendPresence();
  else motionTimer ??= setTimeout(() => {
    motionTimer = null;
    if (useStatus.getState().mine.motion !== sent?.mine.motion) sendPresence();
  }, wait);
};
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let enterSeq = 0; // 겹쳐 호출된 enter 중 마지막 것만 연결을 만든다
let starting: Promise<void> | null = null; // start도 동시에 한 번만

const presenceOf = (): PresenceMember | null => {
  const { userId, profile } = useMe.getState();
  if (!userId || !profile) return null;
  return {
    userId,
    name: profile.name,
    avatarId: profile.avatarId,
    ...useStatus.getState().mine,
    sessionId,
    connectedAt,
    seat: useRoom.getState().seat,
    seatedAt: useRoom.getState().seatedAt,
  };
};

export const useRoom = create<RoomState>((set, get) => {
  const disconnect = async () => {
    const old = conn;
    conn = null;
    await old?.disconnect();
  };

  // 방이 없으면(ownerId null) 연결하지 않고 혼자 있는 빈 방을 보여준다
  const enter = async (ownerId: string | null) => {
    const seq = ++enterSeq;
    clearMotionTimer();
    await disconnect();
    if (seq !== enterSeq) return;
    // 내 방(또는 방 없음)에서는 기본 가구(침대)에 앉은 채로 시작, 남의 방에서는 서 있다가 가구를 눌러 앉는다
    set({ seat: ownerId === null || ownerId === useMe.getState().userId ? DEFAULT_SEAT : null, seatedAt: Date.now() });
    useChat.getState().reset();
    if (!ownerId) {
      set({ ownerId: null, members: [], connection: "idle" });
      sent = { mine: useStatus.getState().mine, at: Date.now() };
      return;
    }
    set({ ownerId, members: [], connection: "connecting" });
    const me = presenceOf();
    conn = connectRoom(ownerId, me, {
      onMembers: (members) => set({ members }),
      onMessage: (m) => useChat.getState().receive(m),
      onStatus: (s) =>
        set({ connection: s === "connected" ? "connected" : s === "error" ? "error" : "idle" }),
      onSuperseded: () => {
        void disconnect();
        set({ connection: "idle", members: [], notice: "다른 곳에서 접속해서 이 연결을 종료했어요." });
      },
    });
    sent = { mine: useStatus.getState().mine, at: Date.now() };
  };

  const homeOrNone = () => (useMe.getState().myRoom ? useMe.getState().userId : null);

  // 서버가 보낸 강퇴/방 닫힘 알림. 이미 떠난 방의 알림은 무시한다.
  const onKicked = async ({ roomOwnerId, kind, reason }: KickEvent) => {
    if (roomOwnerId !== get().ownerId) return;
    const { userId } = useMe.getState();
    if (!userId || roomOwnerId === userId) return;
    if (isChatWindow) {
      await disconnect(); // 채팅 창은 메인 창이 닫는다
      set({ connection: "idle" });
      return;
    }
    // 메인 창: 서버에서는 이미 나간 상태이므로 leave_room 없이 내 방(없으면 빈 방)으로 복귀
    set({ kicked: { text: kind === "closed" ? "방장이 방을 닫았어요." : `강퇴되었습니다 · 사유: ${reason}` } });
    await enter(homeOrNone());
    if (useWindowPrefs.getState().chatOpen) await useWindowPrefs.getState().toggleChat();
  };

  return {
    ownerId: null,
    members: [],
    connection: "idle",
    notice: null,
    kicked: null,
    seat: DEFAULT_SEAT,
    seatedAt: connectedAt,

    setSeat: (seat) => {
      if (seat === get().seat) return;
      set({ seat, seatedAt: Date.now() });
      sendPresence(); // 좌석은 드물게 바뀌므로 바로 보낸다
    },

    dismissKick: () => set({ kicked: null }),

    start: () => {
      starting ??= (async () => {
      const { userId, status } = useMe.getState();
      if (status !== "ready" || !userId) {
        // 오프라인: 내 방만 보여준다
        set({ ownerId: useMe.getState().myRoom ? userId : null, connection: "error" });
        return;
      }
      userChannel ??= openUserChannel(userId, {
        onRoomChanged: () => {},
        onKicked: (e) => void onKicked(e),
        onEconomyChanged: () => void useEconomy.getState().refresh(), // 상점 창에서 해금·장착함
        onPoke: (fromName) => void usePoke.getState().receive(fromName),
      });
      try {
        await leaveRoom(); // 비정상 종료로 남은 입장 기록 정리
      } catch {
        /* 무시 */
      }
      await enter(homeOrNone());

      // 1분마다 "살아 있어요" 신호 (서버가 3분 이상 끊긴 멤버를 정리). 오래 끊겼다가 돌아와
      // 이미 방에서 나가졌다면 내 방으로 복귀한다.
      const beat = async () => {
        try {
          const current = await heartbeat();
          const owner = get().ownerId;
          if (owner && owner !== userId && current !== owner) {
            set({ notice: "연결이 오래 끊겨서 방에서 나가졌어요." });
            await enter(homeOrNone());
            await userChannel?.notifyRoomChanged();
          }
        } catch {
          /* 다음 주기에 다시 */
        }
      };
      heartbeatTimer ??= setInterval(() => void beat(), 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void beat();
      });
      // 내 상태가 바뀔 때만 Presence 갱신 (무료 플랜 메시지 한도)
      statusWatch ??= useStatus.subscribe((s, prev) => {
        if (s.mine !== prev.mine) onMineChanged(s.mine);
      });
      })().finally(() => (starting = null));
      return starting;
    },

    shutdown: async () => {
      const hasOwnRoom = !!useMe.getState().myRoom;
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
      const work = Promise.allSettled([leaveRoom(), hasOwnRoom ? closeRoom() : Promise.resolve()]);
      await Promise.race([work, timeout]);
    },

    joinByCode: async (code) => {
      set({ notice: null, kicked: null });
      try {
        const owner = await joinRoom(code);
        await enter(owner);
        await userChannel?.notifyRoomChanged();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    kick: async (targetUserId, reason) => {
      set({ notice: null });
      try {
        await kickMember(targetUserId, reason);
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    goHome: async () => {
      const { userId } = useMe.getState();
      if (!userId) return;
      try {
        await leaveRoom();
        await enter(homeOrNone());
        await userChannel?.notifyRoomChanged();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    // 새 방 + 새 코드 → 자동 입장. 이전 방의 채팅 기록은 서버에서 사라진다.
    createRoom: async () => {
      const { userId } = useMe.getState();
      if (!userId) return;
      set({ notice: null, kicked: null });
      try {
        const code = await createRoom();
        useMe.getState().setMyRoom({ code, isOpen: true });
        await enter(userId);
        await userChannel?.notifyRoomChanged();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    closeRoom: async () => {
      const { userId } = useMe.getState();
      if (!userId) return;
      set({ notice: null });
      try {
        await closeRoom();
        useMe.getState().setMyRoom(null);
        if (get().ownerId === userId) await enter(null);
        await userChannel?.notifyRoomChanged();
      } catch (err) {
        set({ notice: describeError(err) });
      }
    },

    startChatFollower: async () => {
      const { userId, status } = useMe.getState();
      if (status !== "ready" || !userId) return;

      const follow = async () => {
        try {
          const owner = await getMyRoom();
          if (owner === get().ownerId) return;
          await disconnect();
          useChat.getState().reset();
          if (!owner) {
            set({ ownerId: null, connection: "idle" });
            return;
          }
          set({ ownerId: owner, connection: "connecting" });
          conn = connectRoom(owner, null, {
            onMessage: (m) => useChat.getState().receive(m),
            onStatus: (s) =>
              set({ connection: s === "connected" ? "connected" : s === "error" ? "error" : "idle" }),
          });
          await useChat.getState().load(owner);
        } catch (err) {
          set({ notice: describeError(err) });
        }
      };

      isChatWindow = true;
      userChannel ??= openUserChannel(userId, {
        onRoomChanged: () => void follow(),
        onKicked: (e) => void onKicked(e),
      });
      await follow();
    },
  };
});

/** 화면에 그릴 멤버. 방이 없거나 서버에 닿지 않으면 나 혼자 (오프라인으로도 열림) */
export function useShownMembers(): PresenceMember[] {
  const members = useRoom((s) => s.members);
  const { userId, profile } = useMe();
  const mine = useStatus((s) => s.mine);
  const seat = useRoom((s) => s.seat);
  const seatedAt = useRoom((s) => s.seatedAt);
  if (!profile || !userId) return members;
  // 내 항목은 서버를 거치지 않은 로컬 값으로 덮어써서 클릭 즉시 반응하게 한다
  const me: PresenceMember = {
    userId, name: profile.name, avatarId: profile.avatarId, ...mine, sessionId, connectedAt, seat, seatedAt,
  };
  if (members.length === 0) return [me];
  return members.map((m) => (m.userId === userId ? { ...m, ...me, connectedAt: m.connectedAt } : m));
}
