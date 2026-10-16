import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types";
import { useChat } from "../../store/chat";
import { useMe } from "../../store/me";
import { useRoom } from "../../store/room";
import { Icon } from "../common/Icon";
import { ProfileSetup } from "../common/ProfileSetup";
import { TitleBar } from "../common/TitleBar";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
const minuteOf = (iso: string) => Math.floor(new Date(iso).getTime() / 60000);

// 카톡처럼: 같은 사람이 같은 시각(분)에 보낸 연속 메시지는 한 묶음. 시스템 메시지는 묶음을 끊는다.
type Group = { key: number; kind: "chat" | "system"; userId: string | null; items: ChatMessage[] };
function groupMessages(messages: ChatMessage[]): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    if (m.kind === "chat" && last?.kind === "chat" && last.userId === m.userId && minuteOf(last.items[0].createdAt) === minuteOf(m.createdAt)) {
      last.items.push(m);
    } else {
      groups.push({ key: m.id, kind: m.kind, userId: m.userId, items: [m] });
    }
  }
  return groups;
}

export function ChatWindow() {
  const { status, userId, profile } = useMe();
  const ownerId = useRoom((s) => s.ownerId);
  const connection = useRoom((s) => s.connection);
  const { messages, names, error } = useChat();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void useMe.getState().init().then(() => useRoom.getState().startChatFollower());
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [messages.length]);

  if (status === "needsProfile") return <ProfileSetup />;
  if (status !== "ready") {
    return (
      <div className="chat">
        <TitleBar title="채팅" />
        <p className="hint">{status === "booting" ? "연결 중…" : "서버에 연결할 수 없어요"}</p>
      </div>
    );
  }

  const nameOf = (id: string | null) => (id === userId ? profile?.name : id && names[id]) || "…";

  return (
    <div className="chat">
      <TitleBar title="채팅" />
      <div className="log">
        {groupMessages(messages).map((g) =>
          g.kind === "system" ? (
            <div key={g.key} className="sys">{g.items[0].body}</div>
          ) : (
            <div key={g.key} className={`group ${g.userId === userId ? "mine" : ""}`}>
              <b>{nameOf(g.userId)}</b>
              {g.items.map((m, i) => (
                <div key={m.id} className={`line ${m.pending ? "pending" : ""}`}>
                  {i === g.items.length - 1 && <time>{formatTime(m.createdAt)}</time>}
                  <span>{m.body}</span>
                </div>
              ))}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>
      {error && <p className="err">{error}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ownerId || !userId) return;
          const body = text;
          setText(""); // 저장을 기다리지 않고 바로 비운다 (실패하면 되돌림)
          if (!(await useChat.getState().send(ownerId, userId, body))) setText(body);
        }}
      >
        <input
          value={text}
          maxLength={200}
          disabled={connection !== "connected"}
          placeholder={connection === "connected" ? "메시지" : ownerId ? "연결 중…" : "방이 없어요"}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="send" disabled={!text.trim()} title="보내기" aria-label="보내기"><Icon name="send" /></button>
      </form>
    </div>
  );
}
