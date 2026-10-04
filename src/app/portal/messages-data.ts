import "server-only";
import type { PortalData } from "@/lib/portal";

/** My conversations, newest first, with names and unread counts. */
export async function loadConversations(p: PortalData) {
  if (!p.memberId) return { convos: [], messages: [] };
  const { data: msgs } = await p.supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const messages = msgs ?? [];
  const others = [...new Set(messages.map((m) => (m.sender_id === p.memberId ? m.recipient_id : m.sender_id)))];
  const { data: names } = others.length
    ? await p.supabase.rpc("member_names", { ids: others })
    : { data: [] };
  const convos = others.map((id) => {
    const last = messages.find((m) => m.sender_id === id || m.recipient_id === id)!;
    return {
      id,
      name: (names ?? []).find((n) => n.id === id)?.name ?? "Member",
      last: last.body,
      at: last.created_at,
      unread: messages.filter((m) => m.sender_id === id && !m.read_at).length,
    };
  });
  return { convos, messages };
}

export type Convo = Awaited<ReturnType<typeof loadConversations>>["convos"][number];
