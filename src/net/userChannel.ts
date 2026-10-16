import { supabase } from "./supabase";

/** kick: 방장이 내보냄 / closed: 방장이 방을 닫음 */
export type KickEvent = { roomOwnerId: string; kind: "kick" | "closed"; reason: string };

/**
 * `user:{userId}` 비공개 채널. 내 창들(메인·채팅)끼리 "방이 바뀌었다"를 서버를 통해 알리고,
 * 서버가 보내는 강퇴 알림(`kick`)도 여기로 온다. 창끼리 직접 상태를 주고받지 않는다.
 */
export function openUserChannel(
  userId: string,
  handlers: { onRoomChanged: () => void; onKicked: (e: KickEvent) => void; onEconomyChanged?: () => void; onPoke?: (fromName: string) => void },
) {
  const channel = supabase.channel(`user:${userId}`, { config: { private: true } });
  let ready = false;
  channel
    .on("broadcast", { event: "room-changed" }, handlers.onRoomChanged)
    .on("broadcast", { event: "economy-changed" }, () => handlers.onEconomyChanged?.())
    .on("broadcast", { event: "poke" }, ({ payload }) => {
      const name = (payload as { fromName?: string } | null)?.fromName;
      handlers.onPoke?.(typeof name === "string" ? name.slice(0, 12) : "친구");
    })
    .on("broadcast", { event: "kick" }, ({ payload }) => {
      const p = payload as Partial<KickEvent> | null;
      if (p?.roomOwnerId) handlers.onKicked({ roomOwnerId: p.roomOwnerId, kind: p.kind === "closed" ? "closed" : "kick", reason: p.reason ?? "" });
    })
    .subscribe((status) => {
      ready = status === "SUBSCRIBED";
    });

  return {
    notifyRoomChanged: async () => {
      if (!ready) return;
      await channel.send({ type: "broadcast", event: "room-changed", payload: {} });
    },
    /** 상점 창에서 해금·장착했음을 메인 창에 알린다 */
    notifyEconomyChanged: async () => {
      if (!ready) return;
      await channel.send({ type: "broadcast", event: "economy-changed", payload: {} });
    },
    close: async () => {
      await supabase.removeChannel(channel);
    },
  };
}
