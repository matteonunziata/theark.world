"use server";

import { getViewer } from "@/lib/auth";

export async function unsubscribe(_prev: unknown, data: FormData): Promise<"ok" | "unknown"> {
  const id = String(data.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return "unknown";
  const { supabase } = await getViewer();
  const { data: r } = await supabase.rpc("email_unsubscribe", { p_send: id });
  return r === "ok" ? "ok" : "unknown";
}
