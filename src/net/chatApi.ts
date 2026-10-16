import type { ChatMessage } from "../types";
import { supabase } from "./supabase";

type MessageRow = {
  id: number;
  room_owner_id: string;
  user_id: string | null;
  kind: "chat" | "system";
  body: string;
  created_at: string;
};

export const toChatMessage = (r: MessageRow): ChatMessage => ({
  id: r.id,
  roomOwnerId: r.room_owner_id,
  userId: r.user_id,
  kind: r.kind,
  body: r.body,
  createdAt: r.created_at,
});

/** 입장 시 최근 50개 */
export async function loadRecent(ownerId: string, limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, room_owner_id, user_id, kind, body, created_at")
    .eq("room_owner_id", ownerId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as MessageRow[]).map(toChatMessage).reverse();
}

/** 저장된 행을 돌려준다 (화면의 임시 메시지를 이 행으로 바꾸는 데 쓴다) */
export async function sendChat(ownerId: string, userId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ room_owner_id: ownerId, user_id: userId, kind: "chat", body })
    .select("id, room_owner_id, user_id, kind, body, created_at")
    .single();
  if (error) throw error;
  return toChatMessage(data as MessageRow);
}
