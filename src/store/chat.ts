import { create } from "zustand";
import type { ChatMessage } from "../types";
import { loadRecent, sendChat } from "../net/chatApi";
import { describeError } from "../net/errors";
import { fetchProfiles } from "../net/rpc";
import { useMe } from "./me";
import { useWindowPrefs } from "./windowPrefs";

const BUBBLE_MS = 3000;
const MAX_KEPT = 200;
let tempSeq = 0; // 임시 메시지 id (음수)
const bubbleTimers = new Map<string, ReturnType<typeof setTimeout>>();

type Bubble = { id: number; text: string };

interface ChatState {
  messages: ChatMessage[];
  names: Record<string, string>; // userId → 이름
  bubbles: Record<string, Bubble>; // userId → 머리 위 말풍선 (3초)
  error: string | null;
  /** 채팅창이 닫혀 있는 동안 남이 보낸 메시지가 왔는지 (메인 창에서만 켠다) */
  unread: boolean;
  trackUnread: boolean;
  clearUnread: () => void;
  load: (ownerId: string) => Promise<void>;
  receive: (message: ChatMessage) => void;
  send: (ownerId: string, userId: string, body: string) => Promise<boolean>;
  rememberNames: (names: Record<string, string>) => void;
  reset: () => void;
}

export const useChat = create<ChatState>((set, get) => {
  const ensureNames = async (ids: (string | null)[]) => {
    const missing = [...new Set(ids)].filter((id): id is string => !!id && !get().names[id]);
    if (missing.length === 0) return;
    try {
      const profiles = await fetchProfiles(missing);
      get().rememberNames(Object.fromEntries(profiles.map((p) => [p.id, p.name])));
    } catch {
      /* 이름은 나중에 다시 시도된다 */
    }
  };

  return {
    messages: [],
    names: {},
    bubbles: {},
    error: null,
    unread: false,
    trackUnread: false,
    clearUnread: () => set({ unread: false }),

    load: async (ownerId) => {
      try {
        const messages = await loadRecent(ownerId);
        set({ messages, error: null });
        await ensureNames(messages.map((m) => m.userId));
      } catch (err) {
        set({ error: describeError(err) });
      }
    },

    receive: (message) => {
      if (get().messages.some((m) => m.id === message.id)) return;
      // 내가 방금 보낸 임시 메시지가 있으면 서버가 확정한 행으로 대체한다
      set((s) => {
        const i = s.messages.findIndex((m) => m.pending && m.userId === message.userId && m.body === message.body);
        const rest = i < 0 ? s.messages : s.messages.filter((_, j) => j !== i);
        return { messages: [...rest, message].slice(-MAX_KEPT) };
      });
      void ensureNames([message.userId]);

      if (message.kind !== "chat" || !message.userId) return;
      const userId = message.userId;
      if (get().trackUnread && userId !== useMe.getState().userId && !useWindowPrefs.getState().chatOpen) set({ unread: true });
      set((s) => ({ bubbles: { ...s.bubbles, [userId]: { id: message.id, text: message.body } } }));
      clearTimeout(bubbleTimers.get(userId));
      bubbleTimers.set(
        userId,
        setTimeout(() => {
          set((s) => {
            if (s.bubbles[userId]?.id !== message.id) return s;
            const { [userId]: _gone, ...rest } = s.bubbles;
            return { bubbles: rest };
          });
        }, BUBBLE_MS),
      );
    },

    send: async (ownerId, userId, body) => {
      const text = body.trim().slice(0, 200);
      if (!text) return false;
      // 낙관적 표시: 저장을 기다리지 않고 바로 보여주고, 저장되면 서버 행으로 바꾼다
      const tempId = --tempSeq;
      const temp: ChatMessage = {
        id: tempId, roomOwnerId: ownerId, userId, kind: "chat", body: text, createdAt: new Date().toISOString(), pending: true,
      };
      set((s) => ({ messages: [...s.messages, temp].slice(-MAX_KEPT), error: null }));
      try {
        const saved = await sendChat(ownerId, userId, text);
        set((s) => {
          const rest = s.messages.filter((m) => m.id !== tempId);
          // 실시간으로 이미 들어왔다면 임시 메시지만 지운다
          return { messages: rest.some((m) => m.id === saved.id) ? rest : [...rest, saved].slice(-MAX_KEPT) };
        });
        return true;
      } catch (err) {
        set((s) => ({ messages: s.messages.filter((m) => m.id !== tempId), error: describeError(err) }));
        return false;
      }
    },

    rememberNames: (names) => set((s) => ({ names: { ...s.names, ...names } })),

    reset: () => {
      bubbleTimers.forEach(clearTimeout);
      bubbleTimers.clear();
      set({ messages: [], bubbles: {}, error: null });
    },
  };
});
