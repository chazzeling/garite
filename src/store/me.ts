import { create } from "zustand";
import type { AvatarSpec, Profile, RoomInfo } from "../types";
import { describeError } from "../net/errors";
import { fetchMyRoom, fetchProfile, regenerateCode, saveProfile, setRoomOpen } from "../net/rpc";
import { DEFAULT_AVATAR, encodeAvatar } from "../assets/avatar";
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
  /** 캐릭터 꾸미기 저장 (서버가 해금 여부를 검증). 실패하면 사유 문구, 성공하면 null */
  setAvatar: (spec: AvatarSpec) => Promise<string | null>;
  /** 다른 창에서 바꾼 프로필을 다시 읽음 */
  refreshProfile: () => Promise<void>;
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
      const profile = await saveProfile(userId, name.trim(), encodeAvatar(DEFAULT_AVATAR));
      const myRoom = await fetchMyRoom(userId);
      set({ profile, myRoom, status: "ready", error: null });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  setMyRoom: (myRoom) => set({ myRoom }),

  setAvatar: async (spec) => {
    const { userId, profile } = get();
    if (!userId || !profile) return "프로필이 없어요.";
    try {
      set({ profile: await saveProfile(userId, profile.name, encodeAvatar(spec)) });
      return null;
    } catch (err) {
      return describeError(err);
    }
  },

  refreshProfile: async () => {
    const { userId } = get();
    if (!userId) return;
    try {
      const profile = await fetchProfile(userId);
      if (profile) set({ profile });
    } catch {
      /* 다음에 다시 */
    }
  },

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
