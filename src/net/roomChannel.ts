import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage, PresenceMember } from "../types";
import { toChatMessage } from "./chatApi";
import { supabase } from "./supabase";

export type ChannelStatus = "connected" | "error" | "closed";

export interface RoomChannelHandlers {
  onMembers?: (members: PresenceMember[]) => void;
  onMessage?: (message: ChatMessage) => void;
  onStatus: (status: ChannelStatus) => void;
  /** 같은 계정이 다른 곳에서 더 늦게 접속했다 → 이 연결을 종료해야 한다 */
  onSuperseded?: () => void;
}

export interface RoomConnection {
  /** 내 Presence 갱신 (값이 바뀔 때만 호출할 것) */
  update: (me: PresenceMember) => void;
  disconnect: () => Promise<void>;
}

/**
 * `room:{ownerId}` 비공개 채널에 접속한다. 멤버가 아니면 서버가 구독을 거절한다.
 * me가 없으면 Presence에 참여하지 않고 메시지만 받는다 (채팅 창).
 */
export function connectRoom(
  ownerId: string,
  me: PresenceMember | null,
  handlers: RoomChannelHandlers,
): RoomConnection {
  let current = me;
  const channel: RealtimeChannel = supabase.channel(`room:${ownerId}`, {
    config: { private: true, presence: { key: me?.userId ?? "viewer" } },
  });

  if (handlers.onMessage) {
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `room_owner_id=eq.${ownerId}` },
      (payload) => handlers.onMessage?.(toChatMessage(payload.new as never)),
    );
  }

  if (handlers.onMembers) {
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceMember>();
      const members: PresenceMember[] = [];
      for (const metas of Object.values(state)) {
        // 같은 사용자의 접속이 여럿이면 가장 늦은 것만 인정
        const latest = metas.reduce((a, b) => (b.connectedAt >= a.connectedAt ? b : a));
        if (me && latest.userId === me.userId && latest.sessionId !== me.sessionId) {
          handlers.onSuperseded?.();
          continue;
        }
        members.push(latest);
      }
      handlers.onMembers?.(members);
    });
  }

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      handlers.onStatus("connected");
      // 재접속 때마다 현재 상태를 한 번 다시 보낸다
      if (current) await channel.track(current);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      handlers.onStatus("error");
    } else if (status === "CLOSED") {
      handlers.onStatus("closed");
    }
  });

  return {
    update: (next) => {
      current = next;
      void channel.track(next);
    },
    disconnect: async () => {
      await supabase.removeChannel(channel);
    },
  };
}
