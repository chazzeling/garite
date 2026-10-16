import type { Profile, RoomInfo } from "../types";
import { supabase } from "./supabase";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const row = check(
    await supabase.from("profiles").select("id, name, avatar_id").eq("id", userId).maybeSingle(),
  );
  return row ? { id: row.id, name: row.name, avatarId: row.avatar_id } : null;
}

export async function saveProfile(userId: string, name: string, avatarId: string): Promise<Profile> {
  check(await supabase.from("profiles").upsert({ id: userId, name, avatar_id: avatarId }));
  return { id: userId, name, avatarId };
}

export async function fetchProfiles(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const rows = check(await supabase.from("profiles").select("id, name, avatar_id").in("id", ids));
  return (rows ?? []).map((r) => ({ id: r.id, name: r.name, avatarId: r.avatar_id }));
}

/** 내 방이 있으면 정보, 없으면 null */
export async function fetchMyRoom(userId: string): Promise<RoomInfo | null> {
  const row = check(
    await supabase.from("rooms").select("code, is_open").eq("owner_id", userId).maybeSingle(),
  );
  return row ? { code: row.code, isOpen: row.is_open } : null;
}

/** 새 방 + 새 코드. 이전 방과 채팅 기록은 서버가 지운다 */
export async function createRoom(): Promise<string> {
  return check(await supabase.rpc("create_room"));
}

export async function closeRoom(): Promise<void> {
  check(await supabase.rpc("close_room"));
}

export async function setRoomOpen(userId: string, isOpen: boolean): Promise<void> {
  check(await supabase.from("rooms").update({ is_open: isOpen }).eq("owner_id", userId));
}

export async function regenerateCode(): Promise<string> {
  return check(await supabase.rpc("regenerate_code"));
}

/** 성공하면 입장한 방의 방장 id */
export async function joinRoom(code: string): Promise<string> {
  return check(await supabase.rpc("join_room", { p_code: code }));
}

export async function leaveRoom(): Promise<void> {
  check(await supabase.rpc("leave_room"));
}

/** 방장 전용 (서버가 검증) */
export async function kickMember(targetUserId: string, reason: string): Promise<void> {
  check(await supabase.rpc("kick_member", { p_target: targetUserId, p_reason: reason }));
}

/** 지금 내가 있는 방의 방장 id (남의 방에 없으면 내 id, 내 방도 없으면 null) */
export async function getMyRoom(): Promise<string | null> {
  return check(await supabase.rpc("get_my_room"));
}

/** 같은 방 누구나 누구를. 알림 전달·쿨다운은 서버가 처리한다 */
export async function pokeMember(targetUserId: string): Promise<void> {
  check(await supabase.rpc("poke_member", { p_target: targetUserId }));
}

/** 1분마다 "살아 있어요" 신호. 지금 내가 있는 방(방장 id, 내 방, 없으면 null)을 돌려준다 */
export async function heartbeat(): Promise<string | null> {
  return check(await supabase.rpc("heartbeat"));
}
