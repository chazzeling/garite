import { create } from "zustand";
import { persist } from "zustand/middleware";

// 자주 가는 방. 방 코드는 방을 새로 만들 때마다 바뀌므로 "사람"(방장 id)을 저장하고,
// 입장할 때 서버가 그 사람의 지금 방을 찾아 준다 (RPC join_room_by_owner). 이 기기에만 저장.
export type Favorite = { userId: string; name: string };
const MAX = 8;

interface FavoritesState {
  list: Favorite[];
  toggle: (userId: string, name: string) => void;
  remove: (userId: string) => void;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      list: [],
      toggle: (userId, name) => {
        const has = get().list.some((f) => f.userId === userId);
        set({ list: has ? get().list.filter((f) => f.userId !== userId) : [...get().list, { userId, name }].slice(-MAX) });
      },
      remove: (userId) => set({ list: get().list.filter((f) => f.userId !== userId) }),
    }),
    { name: "garite-favorites" },
  ),
);
