import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadPortal } from "@/lib/portal";
import { markRead } from "../../../actions";
import { ConvoList } from "../../../convo-list";
import { loadConversations } from "../../../messages-data";
import { Av } from "../../../ui";
import { Thread } from "./thread";

export const metadata: Metadata = { title: "Messages" };

export default async function ThreadPage({ params }: PageProps<"/portal/messages/[id]">) {
  const { id } = await params;
  const p = await loadPortal();
  if (!p.memberId) redirect("/portal/messages");
  await markRead(id);
  const [{ convos, messages }, { data: names }, { data: allowed }] = await Promise.all([
    loadConversations(p),
    p.supabase.rpc("member_names", { ids: [id] }),
    p.supabase.rpc("can_message", { recipient: id }),
  ]);
  const other = names?.[0];
  if (!other) redirect("/portal/messages");
  const thread = messages
    .filter((m) => m.sender_id === id || m.recipient_id === id)
    .reverse();
  return (
    <div className="pv-chat">
      {convos.length > 0 && <ConvoList convos={convos.map((c) => (c.id === id ? { ...c, unread: 0 } : c))} current={id} />}
      <section className="pv-thread" style={convos.length ? undefined : { gridColumn: "1 / -1" }}>
        <header>
          <Av id={other.id} name={other.name} size="sm" />
          <b>{other.name}</b>
        </header>
        <Thread
          me={p.memberId}
          other={id}
          canSend={!!allowed}
          initial={thread.map((m) => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at }))}
        />
      </section>
    </div>
  );
}
