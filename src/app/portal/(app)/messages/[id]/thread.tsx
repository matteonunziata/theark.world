"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { markRead, sendMessage } from "../../../actions";

type Msg = { id: string; sender_id: string; body: string; created_at: string };

export function Thread({
  me,
  other,
  initial,
  canSend,
}: {
  me: string;
  other: string;
  initial: Msg[];
  canSend: boolean;
}) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const end = useRef<HTMLDivElement>(null);

  // New messages arrive live; RLS only delivers ones I'm part of.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    (async () => {
      // Realtime checks RLS as the signed-in member, so hand it the token first.
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (stopped) return;
      channel = supabase
      .channel(`dm-${me}-${other}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${other}` },
        (payload) => {
          const m = payload.new as Msg & { recipient_id: string };
          if (m.recipient_id !== me) return;
          setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
          markRead(other);
        },
      )
      .subscribe();
    })();
    return () => {
      stopped = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [me, other]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const send = () =>
    start(async () => {
      const body = text.trim();
      if (!body) return;
      const r = await sendMessage(other, body);
      if (!r.ok) {
        toast(r.error ?? "");
        return;
      }
      setMsgs((cur) => [
        ...cur,
        { id: crypto.randomUUID(), sender_id: me, body, created_at: new Date().toISOString() },
      ]);
      setText("");
    });

  return (
    <>
      <div className="pv-msgs">
        {!msgs.length && (
          <p style={{ color: "var(--pv-muted)", margin: "auto", textAlign: "center" }}>
            Say hello. Mention what you have in common, or suggest a time to meet.
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`pv-msg ${m.sender_id === me ? "mine" : ""}`}>
            {m.body}
            <time>
              {new Date(m.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {canSend ? (
        <form
          className="pv-send"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            className="pv-input"
            aria-label="Message"
            placeholder="Write a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" className="pv-btn" disabled={pending || !text.trim()}>
            Send
          </button>
        </form>
      ) : (
        <p className="pv-send" style={{ color: "var(--pv-muted)", margin: 0 }}>
          They aren’t taking new messages right now.
        </p>
      )}
    </>
  );
}
