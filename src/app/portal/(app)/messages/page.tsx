import type { Metadata } from "next";
import Link from "next/link";
import { loadPortal } from "@/lib/portal";
import { ConvoList } from "../../convo-list";
import { loadConversations } from "../../messages-data";

export const metadata: Metadata = { title: "Messages" };

export default async function Messages() {
  const p = await loadPortal();
  const { convos } = await loadConversations(p);
  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 40, margin: 0 }}>Messages</h1>
          <p>Private conversations with other members.</p>
        </div>
      </div>
      {!p.memberId ? (
        <div className="pv-empty">
          <h3>Messages are between members</h3>
          <p>You’re viewing the portal as staff.</p>
        </div>
      ) : !convos.length ? (
        <div className="pv-empty">
          <h3>No conversations yet</h3>
          <p>Find someone who shares your interests and say hello.</p>
          <p>
            <Link className="pv-btn" href="/portal/people">Meet people</Link>
          </p>
        </div>
      ) : (
        <div className="pv-chat">
          <ConvoList convos={convos} />
          <div className="pv-thread" style={{ display: "grid", placeItems: "center", color: "var(--pv-muted)" }}>
            Pick a conversation.
          </div>
        </div>
      )}
    </>
  );
}
