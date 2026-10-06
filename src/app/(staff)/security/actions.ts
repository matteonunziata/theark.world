"use server";

import { staffOrThrow } from "@/lib/auth";

export type GateMatch = {
  contact_id: string;
  name: string;
  photo_path: string | null;
  phone_hint: string | null;
  pass_token: string;
  tier_name: string | null;
  state: string;
  valid_until: string | null;
};

/** Find a member or pass holder by name, phone or email when the QR won't scan. */
export async function searchGate(q: string): Promise<GateMatch[]> {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator", "security");
  if (q.trim().length < 2) return [];
  const { data } = await supabase.rpc("gate_search", { q: q.trim().slice(0, 80) });
  return (data ?? []) as GateMatch[];
}
