import { create } from "zustand";
import type { Profile, RoomInfo } from "../types";
import { describeError } from "../net/errors";
import { fetchMyRoom, fetchProfile, regenerateCode, saveProfile, setRoomOpen } from "../net/rpc";
import { ensureSession, isConfigured } from "../net/supabase";

type MeStatus = "booting" | "needsProfile" | "ready" | "offline";

interface MeState {
  status: MeStatus;
  userId: string | null;
  profile: Profile | null;
  myRoom: RoomInfo | null;
  error: string | null;
  init: () => Promise<void>;
  createProfile: (name: string) => Promise<void>;
  toggleOpen: () => Promise<void>;
  reissueCode: () => Promise<void>;
  setMyRoom: (room: RoomInfo | null) => void;
}

let booting: Promise<void> | null = null; // StrictMode 등으로 init이 겹쳐 불려도 한 번만

export const useMe = create<MeState>((set, get) => ({
  status: "booting",
  userId: null,
  profile: null,
  myRoom: null,
  error: null,

  // 서버에 닿지 않으면 offline — 내 방은 그대로 열린다
  init: () => {
    booting ??= (async () => {
    set({ status: "booting", error: null });
    if (!isConfigured) {
      set({ status: "offline", error: "서버 설정이 없어요 (.env.local)" });
      return;
    }
    try {
      const userId = await ensureSession();
      set({ userId });
      const profile = await fetchProfile(userId);
      if (!profile) {
        set({ status: "needsProfile" });
        return;
      }
      const myRoom = await fetchMyRoom(userId);
      set({ profile, myRoom, status: "ready" });
    } catch (err) {
      set({ status: "offline", error: describeError(err) });
    }
    })().finally(() => (booting = null));
    return booting;
  },

  createProfile: async (name) => {
    const { userId } = get();
    if (!userId) return;
    try {
      const profile = await saveProfile(userId, name.trim(), "default");
      const myRoom = await fetchMyRoom(userId);
      set({ profile, myRoom, status: "ready", error: null });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  setMyRoom: (myRoom) => set({ myRoom }),

  toggleOpen: async () => {
    const { userId, myRoom } = get();
    if (!userId || !myRoom) return;
    try {
      await setRoomOpen(userId, !myRoom.isOpen);
      set({ myRoom: { ...myRoom, isOpen: !myRoom.isOpen }, error: null });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  reissueCode: async () => {
    const { myRoom } = get();
    if (!myRoom) return;
    try {
      set({ myRoom: { ...myRoom, code: await regenerateCode() }, error: null });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },
}));
